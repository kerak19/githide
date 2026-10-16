(() => {
  const fileSelector = '[role="region"][id^="diff-"], .file[id][data-file-type]';
  const generated = new Set();
  let currentView = '';
  let hide = false;
  let scheduled = false;

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

    let control = document.getElementById('githide-control');
    if (!control) {
      const toolbar = document.getElementById('changes-selector-button')?.closest('section') ||
        document.querySelector('.pr-review-tools');
      if (!toolbar) return;
      control = document.createElement('label');
      control.id = 'githide-control';
      control.title = 'Hide diff cards GitHub identifies as generated. Uncheck to show them again.';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = hide;
      checkbox.addEventListener('change', () => {
        hide = checkbox.checked;
        update();
      });
      const text = document.createElement('span');
      text.textContent = 'Hide generated files';
      control.append(checkbox, text);
      toolbar.append(control);
    }
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
  update();
})();
