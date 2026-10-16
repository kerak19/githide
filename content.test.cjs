const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {JSDOM} = require('jsdom');

const script = readFileSync(`${__dirname}/content.js`, 'utf8');
const notice = '<span class="fgColor-muted">Some generated files are not rendered by default. Learn more about <a href="https://docs.github.com/github/administering-a-repository/customizing-how-changed-files-appear-on-github">customizing how changed files appear on GitHub.</a></span>';
const file = (id, body = '<table><tr><td>source code</td></tr></table>') =>
  `<div role="region" id="diff-${id}"><h3>${id}</h3>${body}</div>`;
const settle = window => new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));

function page(path = '/owner/repo/pull/1/changes', body = '') {
  const dom = new JSDOM(`<section><h2>Pull request toolbar</h2><button id="changes-selector-button">All commits</button></section>${body}`, {
    url: `https://github.com${path}`, runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const observers = [];
  const Observer = dom.window.MutationObserver;
  dom.window.MutationObserver = class extends Observer {
    constructor(callback) { super(callback); observers.push(this); }
  };
  const close = dom.window.close.bind(dom.window);
  dom.window.close = () => { observers.forEach(observer => observer.disconnect()); close(); };
  dom.window.eval(script);
  return dom;
}

test('checkbox hides only generated cards and restores them without changing viewed state', () => {
  const dom = page(undefined, file('generated', notice) + file('source') + file('quoted', '<table><tr><td>Some generated files are not rendered by default.</td></tr></table>'));
  try {
    const {document, Event} = dom.window;
    const checkbox = document.querySelector('#githide-control input');
    assert.equal(checkbox.checked, false);
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    assert.deepEqual([...document.querySelectorAll('.githide-hidden')].map(e => e.id), ['diff-generated']);
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    assert.equal(document.querySelectorAll('.githide-hidden').length, 0);
    assert.equal(document.querySelectorAll('#githide-control').length, 1);
    assert.equal(document.querySelector('#diff-source table').textContent, 'source code');
  } finally { dom.window.close(); }
});

test('late diffs, replaced toolbar, loaded diff, and navigation are handled', async () => {
  const dom = page(undefined, file('generated', notice));
  const {window} = dom;
  const {document, Event} = window;
  try {
    document.querySelector('#githide-control input').click();
    document.body.insertAdjacentHTML('beforeend', file('late', notice));
    await settle(window);
    assert.equal(document.querySelector('#diff-late').classList.contains('githide-hidden'), true);
    document.querySelector('#diff-generated span').remove();
    document.querySelector('#githide-control').remove();
    await settle(window);
    assert.equal(document.querySelector('#diff-generated').classList.contains('githide-hidden'), true);
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
  } finally { window.close(); }
});

test('legacy generated marker works and unrelated pages have no checkbox', () => {
  const dom = page('/owner/repo/pull/1/files', '<div class="file" id="diff-legacy" data-file-type="go" data-generated="true">generated</div>');
  try {
    dom.window.document.querySelector('#githide-control input').click();
    assert.ok(dom.window.document.querySelector('#diff-legacy.githide-hidden'));
  } finally { dom.window.close(); }
  const other = page('/owner/repo/issues/1');
  try { assert.equal(other.window.document.querySelector('#githide-control'), null); }
  finally { other.window.close(); }
});

test('manifest is MV3, GitHub-only, and references existing runtime files', () => {
  const manifest = JSON.parse(readFileSync(`${__dirname}/manifest.json`, 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://github.com/*']);
  assert.equal(manifest.permissions, undefined);
  for (const name of [...manifest.content_scripts[0].js, ...manifest.content_scripts[0].css]) {
    assert.ok(readFileSync(`${__dirname}/${name}`).length);
  }
});
