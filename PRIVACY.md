# GitHide privacy policy

Last updated: October 16, 2026

GitHide adds a checkbox to hide generated file diffs in GitHub pull requests.

## Data handling

GitHide reads the current GitHub page's URL and rendered diff markup locally
to find GitHub's generated-file notices and show or hide the matching cards
and file tree entries.
File identifiers stay in the tab's memory until the page is reloaded or closed.
GitHide stores only your checkbox preference (`hideGenerated`, true or false)
in the extension's local browser storage so it persists across reloads and PRs.
This preference is shared with your other open GitHub tabs, but is not synced
to other devices or sent to a server. It is cleared when you remove the extension.

GitHide does not collect, transmit, sell, or share personal information,
repository content, browsing history, credentials, or other user data. It makes
no network requests and includes no analytics, advertising, or remote code.

## Site access

The extension runs on `https://github.com/*` so that it can follow GitHub's
navigation into a pull request without requiring a full page reload. It only
adds its control and hides diff cards and file tree entries on pull request Files changed pages.
It does not change repository files, submit reviews, or mark files as viewed.

## Contact

Questions or concerns can be reported at
[GitHide issues](https://github.com/kerak19/githide/issues).
Please do not include private repository content or credentials in public issues.
