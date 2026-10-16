(async () => {
  const fileSelector = '[role="region"][id^="diff-"], .file[id][data-file-type]';
  const generated = new Set();
  let currentView = '';
  let hide = false;
  let scheduled = false;

  try {
    hide = (await chrome.storage.local.get('hideGenerated')).hideGenerated === true;
  } catch (error) {
    console.warn('GitHide could not load the saved setting.', error);
  }

  function update() {
    scheduled = false;
    const view = location.pathname + location.search;
    if (view !== currentView) {
      currentView = view;
      generated.clear();
    }

    const isFilesView = /^\/[^/]+\/[^/]+\/pull\/\d+\/(?:changes|files)(?:\/|$)/.test(location.pathname);
    if (!isFilesView) {
      document.getElementById('githide-control')?.remove();
      document.querySelectorAll('.githide-hidden').forEach(file => file.classList.remove('githide-hidden'));
      return;
    }

    // shortcut: uses GitHub's English generated-file notice; update if GitHub changes its markup or wording.
    const files = [...document.querySelectorAll(fileSelector)];
    for (const file of files) {
      if (file.matches('[data-generated="true"]') ||
          [...file.querySelectorAll('a[href*="/customizing-how-changed-files-appear-on-github"]')].some(link =>
            !link.closest('table') && link.parentElement.textContent.trim()
              .startsWith('Some generated files are not rendered by default.'))) {
        generated.add(file.id);
      }
      file.classList.toggle('githide-hidden', hide && generated.has(file.id));
    }

    const treeItems = [...document.querySelectorAll('#pr-file-tree [role="treeitem"]')];
    for (const item of treeItems.reverse()) {
      const children = [...item.querySelectorAll('[role="treeitem"]')];
      const link = item.querySelector('a[href^="#diff-"]');
      const hidden = children.length
        ? children.every(child => child.classList.contains('githide-hidden'))
        : !item.hasAttribute('aria-expanded') && link && generated.has(link.hash.slice(1));
      item.classList.toggle('githide-hidden', hide && Boolean(hidden));
    }

    let control = document.getElementById('githide-control');
    if (!control) {
      const selector = document.getElementById('changes-selector-button');
      const toolbar = selector?.closest('[data-component="Stack"]') ||
        selector?.closest('section') || document.querySelector('.pr-review-tools');
      if (!toolbar) return;
      control = document.createElement('label');
      control.id = 'githide-control';
      control.title = 'Hide generated diffs and their file tree entries. Uncheck to show them again. The count includes only files detected so far.';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = hide;
      checkbox.addEventListener('change', () => {
        hide = checkbox.checked;
        update();
        chrome.storage.local.set({hideGenerated: hide}).catch(error =>
          console.warn('GitHide could not save the setting.', error));
      });
      const text = document.createElement('span');
      text.textContent = 'Hide generated files';
      control.append(checkbox, text);
      toolbar.append(control);
    }
    control.querySelector('input').checked = hide;
    const text = control.querySelector('span');
    const label = hide ? `Hide generated files · ${generated.size} hidden` : 'Hide generated files';
    if (text.textContent !== label) text.textContent = label;
  }

  const observer = new MutationObserver(() => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(update);
    }
  });
  observer.observe(document.documentElement, {childList: true, subtree: true, characterData: true});
  document.addEventListener('turbo:load', update);
  window.addEventListener('popstate', update);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.hideGenerated) {
      hide = changes.hideGenerated.newValue === true;
      update();
    }
  });
  update();
})();
