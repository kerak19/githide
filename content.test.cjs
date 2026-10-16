const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {JSDOM} = require('jsdom');

const script = readFileSync(`${__dirname}/content.js`, 'utf8');
const notice = '<span class="fgColor-muted">Some generated files are not rendered by default. Learn more about <a href="https://docs.github.com/github/administering-a-repository/customizing-how-changed-files-appear-on-github">customizing how changed files appear on GitHub.</a></span>';
const file = (id, body = '<table><tr><td>source code</td></tr></table>') =>
  `<div role="region" id="diff-${id}"><h3>${id}</h3>${body}</div>`;
const settle = window => new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));

function createStorage(data = {}) {
  const listeners = [];
  return {
    local: {
      async get(key) { return {[key]: data[key]}; },
      async set(values) {
        const changes = {};
        for (const [key, newValue] of Object.entries(values)) {
          changes[key] = {oldValue: data[key], newValue};
          data[key] = newValue;
        }
        listeners.forEach(listener => listener(changes, 'local'));
      },
    },
    onChanged: {addListener(listener) { listeners.push(listener); }},
  };
}

async function page(path = '/owner/repo/pull/1/changes', body = '', storage = createStorage()) {
  const dom = new JSDOM(`<section><h2>Pull request toolbar</h2><div data-component="Stack" id="left-tools"><div><button id="changes-selector-button">All commits</button></div></div><div id="review-tools"><button>Submit review</button></div></section>${body}`, {
    url: `https://github.com${path}`, runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const observers = [];
  const Observer = dom.window.MutationObserver;
  dom.window.MutationObserver = class extends Observer {
    constructor(callback) { super(callback); observers.push(this); }
  };
  const close = dom.window.close.bind(dom.window);
  dom.window.close = () => { observers.forEach(observer => observer.disconnect()); close(); };
  dom.window.chrome = {storage};
  await dom.window.eval(script);
  return dom;
}

test('checkbox hides only generated cards and restores them without changing viewed state', async () => {
  const dom = await page(undefined, file('generated', notice) + file('source') + file('quoted', '<table><tr><td>Some generated files are not rendered by default.</td></tr></table>'));
  try {
    const {document, Event} = dom.window;
    const checkbox = document.querySelector('#githide-control input');
    assert.equal(checkbox.checked, false);
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    assert.deepEqual([...document.querySelectorAll('.githide-hidden')].map(e => e.id), ['diff-generated']);
    assert.equal(document.querySelector('#githide-control span').textContent, 'Hide generated files · 1 hidden');
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    assert.equal(document.querySelectorAll('.githide-hidden').length, 0);
    assert.equal(document.querySelector('#githide-control span').textContent, 'Hide generated files');
    assert.equal(document.querySelectorAll('#githide-control').length, 1);
    assert.equal(document.querySelector('#githide-control').parentElement.id, 'left-tools');
    assert.equal(document.querySelector('section').lastElementChild.id, 'review-tools');
    assert.equal(document.querySelector('section').children.length, 3);
    assert.equal(document.querySelector('#diff-source table').textContent, 'source code');
  } finally { dom.window.close(); }
});

test('late diffs, replaced toolbar, loaded diff, and navigation are handled', async () => {
  const dom = await page(undefined, file('generated', notice));
  const {window} = dom;
  const {document, Event} = window;
  try {
    document.querySelector('#githide-control input').click();
    document.body.insertAdjacentHTML('beforeend', file('late', notice));
    await settle(window);
    assert.equal(document.querySelector('#diff-late').classList.contains('githide-hidden'), true);
    assert.equal(document.querySelector('#githide-control span').textContent, 'Hide generated files · 2 hidden');
    document.querySelector('#diff-generated span').remove();
    document.querySelector('#githide-control').remove();
    await settle(window);
    assert.equal(document.querySelector('#diff-generated').classList.contains('githide-hidden'), true);
    assert.equal(document.querySelector('#githide-control span').textContent, 'Hide generated files · 2 hidden');
    assert.equal(document.querySelector('#githide-control input').checked, true);
    window.history.pushState({}, '', '/owner/repo/pull/1');
    document.dispatchEvent(new Event('turbo:load'));
    assert.equal(document.querySelector('#githide-control'), null);
    assert.equal(document.querySelectorAll('.githide-hidden').length, 0);
    document.querySelector('#diff-late span').remove();
    window.history.pushState({}, '', '/owner/repo/pull/2/files');
    document.dispatchEvent(new Event('turbo:load'));
    assert.ok(document.querySelector('#githide-control'));
    assert.equal(document.querySelectorAll('.githide-hidden').length, 0);
    assert.equal(document.querySelector('#githide-control span').textContent, 'Hide generated files · 0 hidden');
  } finally { window.close(); }
});

test('sidebar hides generated leaves and empty folders, restores them, and handles new entries', async () => {
  const leaf = id => `<li role="treeitem" id="tree-${id}"><a href="#diff-${id}">${id}</a></li>`;
  const dom = await page(undefined, file('generated', notice) + file('source') + `<nav id="pr-file-tree"><ul role="tree">
    <li role="treeitem" id="mixed" aria-expanded="true"><ul role="group">${leaf('source')}
      <li role="treeitem" id="generated-folder" aria-expanded="true"><ul role="group">${leaf('generated')}</ul></li>
    </ul></li><li role="treeitem" id="collapsed" aria-expanded="false">Unloaded folder</li>
    </ul></nav>`);
  const {window} = dom;
  const {document, Event} = window;
  try {
    const checkbox = document.querySelector('#githide-control input');
    checkbox.click();
    assert.ok(document.querySelector('#tree-generated.githide-hidden'));
    assert.ok(document.querySelector('#generated-folder.githide-hidden'));
    assert.equal(document.querySelector('#githide-control span').textContent, 'Hide generated files · 1 hidden');
    assert.equal(document.querySelector('#mixed').classList.contains('githide-hidden'), false);
    assert.equal(document.querySelector('#collapsed').classList.contains('githide-hidden'), false);
    assert.equal(document.querySelector('#tree-source').classList.contains('githide-hidden'), false);
    document.querySelector('#pr-file-tree [role="tree"]').insertAdjacentHTML('beforeend', leaf('late'));
    document.body.insertAdjacentHTML('beforeend', file('late', notice));
    await settle(window);
    assert.ok(document.querySelector('#tree-late.githide-hidden'));
    checkbox.click();
    assert.equal(document.querySelectorAll('.githide-hidden').length, 0);
    checkbox.click();
    window.history.pushState({}, '', '/owner/repo/pull/1');
    document.dispatchEvent(new Event('turbo:load'));
    assert.equal(document.querySelectorAll('.githide-hidden').length, 0);
  } finally { window.close(); }
});

test('preference persists across new pages and synchronizes open tabs', async () => {
  const data = {};
  const storage = createStorage(data);
  const pages = [];
  try {
    const first = await page(undefined, file('first', notice), storage);
    pages.push(first);
    first.window.document.querySelector('#githide-control input').click();
    assert.equal(data.hideGenerated, true);
    assert.deepEqual(Object.keys(data), ['hideGenerated']);

    const next = await page('/owner/repo/pull/2/files', file('second', notice), storage);
    pages.push(next);
    assert.equal(next.window.document.querySelector('#githide-control input').checked, true);
    assert.ok(next.window.document.querySelector('#diff-second.githide-hidden'));
    assert.equal(next.window.document.querySelector('#githide-control span').textContent, 'Hide generated files · 1 hidden');
    next.window.document.querySelector('#githide-control input').click();
    assert.equal(data.hideGenerated, false);
    assert.equal(first.window.document.querySelector('#githide-control input').checked, false);
    assert.equal(first.window.document.querySelectorAll('.githide-hidden').length, 0);

    const reloaded = await page(undefined, file('first', notice), storage);
    pages.push(reloaded);
    assert.equal(reloaded.window.document.querySelector('#githide-control input').checked, false);
    await storage.local.set({hideGenerated: true});
    assert.equal(reloaded.window.document.querySelector('#githide-control input').checked, true);
    assert.ok(reloaded.window.document.querySelector('#diff-first.githide-hidden'));
    await storage.local.set({hideGenerated: undefined});
    assert.equal(reloaded.window.document.querySelector('#githide-control input').checked, false);
  } finally { pages.forEach(dom => dom.window.close()); }
});

test('storage failures leave the toggle usable', async () => {
  const storage = createStorage();
  storage.local.get = async () => { throw new Error('read unavailable'); };
  storage.local.set = async () => { throw new Error('write unavailable'); };
  const dom = await page(undefined, file('generated', notice), storage);
  try {
    const checkbox = dom.window.document.querySelector('#githide-control input');
    assert.equal(checkbox.checked, false);
    checkbox.click();
    await settle(dom.window);
    assert.ok(dom.window.document.querySelector('#diff-generated.githide-hidden'));
    checkbox.click();
    await settle(dom.window);
    assert.equal(dom.window.document.querySelectorAll('.githide-hidden').length, 0);
  } finally { dom.window.close(); }
});

test('legacy generated marker works and unrelated pages have no checkbox', async () => {
  const dom = await page('/owner/repo/pull/1/files', '<div class="file" id="diff-legacy" data-file-type="go" data-generated="true">generated</div>');
  try {
    dom.window.document.querySelector('#githide-control input').click();
    assert.ok(dom.window.document.querySelector('#diff-legacy.githide-hidden'));
  } finally { dom.window.close(); }
  const other = await page('/owner/repo/issues/1');
  try { assert.equal(other.window.document.querySelector('#githide-control'), null); }
  finally { other.window.close(); }
});

test('manifest is MV3, GitHub-only, and references existing runtime files', () => {
  const manifest = JSON.parse(readFileSync(`${__dirname}/manifest.json`, 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://github.com/*']);
  assert.deepEqual(manifest.permissions, ['storage']);
  for (const name of [...manifest.content_scripts[0].js, ...manifest.content_scripts[0].css]) {
    assert.ok(readFileSync(`${__dirname}/${name}`).length);
  }
  for (const [size, name] of Object.entries(manifest.icons)) {
    const png = readFileSync(`${__dirname}/${name}`);
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), Number(size));
    assert.equal(png.readUInt32BE(20), Number(size));
  }
});
