const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {JSDOM} = require('jsdom');

const script = readFileSync(`${__dirname}/content.js`, 'utf8');
const prViewScript = readFileSync(`${__dirname}/pr-view.js`, 'utf8');
const notice = '<span class="fgColor-muted">Some generated files are not rendered by default. Learn more about <a href="https://docs.github.com/github/administering-a-repository/customizing-how-changed-files-appear-on-github">customizing how changed files appear on GitHub.</a></span>';
const file = (id, body = '<table><tr><td>source code</td></tr></table>') =>
  `<div role="region" id="diff-${id}"><h3>${id}</h3>${body}</div>`;
const settle = window => new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));

function createStorage(data = {}) {
  const listeners = [];
  return {
    local: {
      async get(keys) {
        return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, data[key]]));
      },
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
  await dom.window.eval(prViewScript);
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

const conversationFixture = `<div data-component="PH_Actions"><button>Edit</button><button id="code-menu" class="prc-Button-native" data-component="Button" data-size="medium" data-variant="default" aria-expanded="false"><span data-component="buttonContent"><span data-component="leadingVisual">Code icon</span><span data-component="text">Code</span><span data-component="trailingVisual">Chevron</span></span></button></div>
  <aside id="partial-discussion-sidebar">
    <div class="discussion-sidebar-item" data-channel-event-name="labels_updated">Labels</div>
    <div class="discussion-sidebar-item" data-channel-event-name="projects_updated">Projects</div>
    <div class="discussion-sidebar-item" data-channel-event-name="milestone_updated">Milestone</div>
    <create-branch class="discussion-sidebar-item d-block"><div data-channel-event-name="issue_references_updated">Development</div></create-branch>
    <div class="discussion-sidebar-item sidebar-notifications">Notifications</div>
    <div class="discussion-sidebar-item" id="reviewers">Reviewers</div>
  </aside>
  <div class="TimelineItem" id="event-title"><span class="TimelineItem-badge"><svg class="octicon-pencil"></svg></span>Renamed</div>
  <div class="TimelineItem" id="event-push"><span class="TimelineItem-badge"><svg class="octicon-repo-push"></svg></span>Force pushed</div>
  <div class="TimelineItem" id="event-review"><span class="TimelineItem-badge"><svg class="octicon-code-review"></svg></span>Approved</div>
  <div class="TimelineItem" id="event-closed"><span class="TimelineItem-badge"><svg class="octicon-issue-closed"></svg></span>Closed</div>
  <div class="TimelineItem" id="event-unknown">Unknown event</div>
  <div class="TimelineItem" id="event-comment"><span class="TimelineItem-badge"><svg class="octicon-pencil"></svg></span><div class="timeline-comment">Comment</div></div>
  <div class="TimelineItem" id="commit">Commit</div>
  <div id="checks">Checks</div><button id="merge">Merge</button>`;

test('PR dropdown independently hides sidebar sections and known activity, preserving review content', async () => {
  const data = {};
  const dom = await page('/owner/repo/pull/1', conversationFixture, createStorage(data));
  const {document} = dom.window;
  try {
    const menu = document.querySelector('#githide-pr-view');
    assert.ok(menu);
    assert.equal(menu.parentElement.getAttribute('data-component'), 'PH_Actions');
    assert.equal(menu.querySelectorAll('input').length, 6);
    assert.equal(menu.querySelector('summary').className, document.querySelector('#code-menu').className);
    assert.equal(menu.querySelector('summary').getAttribute('data-size'), 'medium');
    assert.equal(menu.querySelector('summary [data-component="text"]').textContent, 'PR view');
    assert.equal(menu.querySelector('summary [data-component="leadingVisual"]'), null);
    assert.equal(menu.querySelector('summary [data-component="trailingVisual"]').textContent, 'Chevron');
    assert.equal(menu.querySelector('summary').id, '');
    assert.equal(document.querySelector('#code-menu [data-component="text"]').textContent, 'Code');
    assert.equal(document.querySelectorAll('.githide-pr-hidden').length, 0);
    menu.querySelector('[name="hideLabels"]').click();
    assert.ok(document.querySelector('[data-channel-event-name="labels_updated"].githide-pr-hidden'));
    assert.equal(document.querySelectorAll('.githide-pr-hidden').length, 1);
    for (const key of ['hideProjects', 'hideMilestone', 'hideDevelopment', 'hideNotifications', 'hideActivity']) {
      menu.querySelector(`[name="${key}"]`).click();
    }
    assert.equal(document.querySelectorAll('.githide-pr-hidden').length, 7);
    assert.deepEqual(Object.values(data), [true, true, true, true, true, true]);
    for (const id of ['reviewers', 'event-review', 'event-closed', 'event-unknown', 'event-comment', 'commit', 'checks', 'merge']) {
      assert.equal(document.getElementById(id).classList.contains('githide-pr-hidden'), false, id);
    }
    for (const input of menu.querySelectorAll('input')) input.click();
    assert.equal(document.querySelectorAll('.githide-pr-hidden').length, 0);
  } finally { dom.window.close(); }
});

test('PR view settings persist, synchronize, handle late sections, and clear on navigation', async () => {
  const storage = createStorage({hideLabels: true, hideActivity: true});
  const first = await page('/owner/repo/pull/1', conversationFixture, storage);
  const second = await page('/owner/repo/pull/2', conversationFixture, storage);
  const {window} = first;
  const {document, Event} = window;
  try {
    assert.equal(document.querySelector('[name="hideLabels"]').checked, true);
    assert.ok(document.querySelector('#event-push.githide-pr-hidden'));
    second.window.document.querySelector('[name="hideLabels"]').click();
    assert.equal(document.querySelector('[name="hideLabels"]').checked, false);
    assert.equal(document.querySelector('[data-channel-event-name="labels_updated"]').classList.contains('githide-pr-hidden'), false);
    document.body.insertAdjacentHTML('beforeend', '<div class="TimelineItem" id="event-late"><span class="TimelineItem-badge"><svg class="octicon-person"></svg></span>Assigned</div>');
    await settle(window);
    assert.ok(document.querySelector('#event-late.githide-pr-hidden'));
    document.querySelector('#githide-pr-view').remove();
    await settle(window);
    assert.equal(document.querySelectorAll('#githide-pr-view').length, 1);
    assert.equal(document.querySelector('[name="hideActivity"]').checked, true);
    window.history.pushState({}, '', '/owner/repo/pull/1/changes');
    document.dispatchEvent(new Event('turbo:load'));
    assert.equal(document.querySelector('#githide-pr-view'), null);
    assert.equal(document.querySelectorAll('.githide-pr-hidden').length, 0);
    window.history.pushState({}, '', '/owner/repo/issues/1');
    document.dispatchEvent(new Event('turbo:load'));
    assert.equal(document.querySelector('#githide-pr-view'), null);
  } finally { first.window.close(); second.window.close(); }
});

test('PR dropdown closes with Escape or an outside click', async () => {
  const dom = await page('/owner/repo/pull/1', conversationFixture);
  const {document, KeyboardEvent} = dom.window;
  try {
    const menu = document.querySelector('#githide-pr-view');
    menu.open = true;
    menu.querySelector('input').focus();
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
    assert.equal(menu.open, false);
    assert.equal(document.activeElement, menu.querySelector('summary'));
    menu.open = true;
    document.querySelector('#checks').click();
    assert.equal(menu.open, false);
  } finally { dom.window.close(); }
});
