(async () => {
  const options = [
    ['hideLabels', 'Labels', '[data-channel-event-name="labels_updated"]'],
    ['hideProjects', 'Projects', '[data-channel-event-name="projects_updated"]'],
    ['hideMilestone', 'Milestone', '[data-channel-event-name="milestone_updated"]'],
    ['hideDevelopment', 'Development', 'create-branch.discussion-sidebar-item, [data-channel-event-name="issue_references_updated"]'],
    ['hideNotifications', 'Notifications', '.sidebar-notifications'],
    ['hideActivity', 'Activity events', '.TimelineItem[id^="event-"]'],
  ];
  let settings = {};
  let scheduled = false;

  try {
    settings = await chrome.storage.local.get(options.map(([key]) => key));
  } catch (error) {
    console.warn('GitHide could not load the PR view settings.', error);
  }

  function update() {
    scheduled = false;
    const isConversation = /^\/[^/]+\/[^/]+\/pull\/\d+\/?$/.test(location.pathname);
    if (!isConversation) {
      document.getElementById('githide-pr-view')?.remove();
      document.querySelectorAll('.githide-pr-hidden').forEach(node => node.classList.remove('githide-pr-hidden'));
      return;
    }

    for (const [key, , selector] of options) {
      for (const node of document.querySelectorAll(selector)) {
        const target = key === 'hideActivity' ? node : node.closest('.discussion-sidebar-item');
        target?.classList.toggle('githide-pr-hidden', settings[key] === true);
      }
    }

    let menu = document.getElementById('githide-pr-view');
    if (!menu) {
      const host = document.querySelector('[data-component="PH_Actions"], .gh-header-actions');
      if (!host) return;
      menu = document.createElement('details');
      menu.id = 'githide-pr-view';
      const summary = document.createElement('summary');
      const codeButton = [...host.querySelectorAll('button')]
        .find(button => (button.querySelector('[data-component="text"]') || button).textContent.trim() === 'Code');
      const codeContent = codeButton?.querySelector('[data-component="buttonContent"]');
      summary.className = 'btn';
      summary.textContent = 'PR view';
      if (codeContent?.querySelector('[data-component="text"]')) {
        for (const attribute of ['class', 'data-component', 'data-loading', 'data-size', 'data-variant']) {
          if (codeButton.hasAttribute(attribute)) summary.setAttribute(attribute, codeButton.getAttribute(attribute));
        }
        const content = codeContent.cloneNode(true);
        content.querySelector('[data-component="leadingVisual"]')?.remove();
        content.querySelector('[data-component="text"]').textContent = 'PR view';
        summary.replaceChildren(content);
      }
      summary.title = 'Choose which PR sections to hide. Choices are saved across PRs.';
      const panel = document.createElement('div');
      panel.className = 'githide-pr-panel Box color-shadow-large';
      for (const [key, name] of options) {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = key;
        checkbox.addEventListener('change', () => {
          settings[key] = checkbox.checked;
          update();
          chrome.storage.local.set({[key]: checkbox.checked}).catch(error =>
            console.warn('GitHide could not save the PR view setting.', error));
        });
        label.append(checkbox, `Hide ${name.toLowerCase()}`);
        if (key === 'hideActivity') {
          label.title = 'Hide all timeline event rows, including deployments and state changes. Comments, review threads, commits and merge controls remain visible.';
        }
        panel.append(label);
      }
      menu.append(summary, panel);
      host.append(menu);
    }
    for (const [key] of options) {
      menu.querySelector(`input[name="${key}"]`).checked = settings[key] === true;
    }
  }

  new MutationObserver(() => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(update);
    }
  }).observe(document.documentElement, {childList: true, subtree: true});
  document.addEventListener('turbo:load', update);
  window.addEventListener('popstate', update);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const [key] of options) {
      if (changes[key]) settings[key] = changes[key].newValue === true;
    }
    update();
  });
  document.addEventListener('click', event => {
    const menu = document.getElementById('githide-pr-view');
    if (menu && !menu.contains(event.target)) menu.open = false;
  });
  document.addEventListener('keydown', event => {
    const menu = document.getElementById('githide-pr-view');
    if (event.key === 'Escape' && menu?.open) {
      menu.open = false;
      menu.querySelector('summary').focus();
    }
  });
  update();
})();
