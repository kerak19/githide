# Chrome Web Store submission

Status: publication paused; not submitted or approved.

## Listing

Name: GitHide

Summary: A small checkbox to hide generated file diffs in GitHub pull requests.

Language: English

Category: Developer Tools

Description:

GitHide adds a small "Hide generated files" checkbox to the toolbar in GitHub's
Files changed tab. Check it to hide generated diff cards, including their file
headers. Uncheck it to bring them back.

GitHide follows GitHub's generated-file notices instead of maintaining a list of
filename patterns. It handles diffs loaded while scrolling and navigation within
GitHub. It also hides generated entries in the left file tree and folders whose
loaded entries are all hidden. It leaves file counts and Viewed state unchanged.

No account, configuration, analytics, or background service. No data leaves your
browser. The checkbox starts unchecked and resets on a full page reload.

Supports github.com pull request /changes and /files pages. GitHub Enterprise
hosts and non-English generated-file notices are not supported. If a generated
diff was already loaded before GitHide starts, its generated-file notice may no
longer be available for detection. Changes to GitHub's markup may require updates.

Free and open source under the MIT license:
https://github.com/kerak19/githide

Homepage: https://github.com/kerak19/githide

Support: https://github.com/kerak19/githide/issues

Privacy policy: https://github.com/kerak19/githide/blob/main/PRIVACY.md

## Privacy practices

Single purpose: Hide generated file diff cards in GitHub pull request reviews
with one reversible checkbox.

Site access justification: GitHide needs to read GitHub's rendered diff markup
to detect generated-file notices and add its checkbox. It matches github.com
pages so it continues to work when GitHub navigates into Files changed without
a full reload. It modifies the page only on pull request /changes and /files
views. Processing stays in the current tab and no data is transmitted or stored
persistently.

Remote code: No. All executable code is included in the extension ZIP.

Data collection: None. Page markup is processed locally; no user data is
collected, transmitted, sold, or shared. Confirm the dashboard disclosures
against PRIVACY.md before submitting.

Distribution: Free, public.

## Assets and outstanding checks

- Extension icon: icons/icon128.png (also included in the ZIP).
- Small promotional image: store/promo440.png (440 x 280).
- Required screenshot: capture at least one real 1280 x 800 or 640 x 400
  screenshot of GitHide on a public GitHub PR after testing the unpacked build.
  Do not publish screenshots of private repositories.
- Verify the actual unpacked extension in Chromium: toggle both ways, scroll
  through lazy-loaded diffs, navigate between Conversation and Files changed,
  and confirm source diffs and Viewed states are unchanged.
- Register a Chrome Web Store developer account if needed. The account owner
  must review the developer agreement and complete the one-time registration
  payment.
- Upload dist/githide-1.0.0.zip in the developer dashboard, complete the listing,
  privacy, and distribution fields, then submit for Google's review. A release
  ZIP on GitHub is not a Chrome Web Store installation.
