# GitHide privacy policy

Last updated: October 16, 2026

GitHide hides generated diffs, selected sidebar sections, and metadata activity
events in GitHub pull requests using reversible display controls.

## Data handling

GitHide reads the current GitHub page's URL and rendered diff markup locally
to find GitHub's generated-file notices and show or hide the matching cards
and file tree entries. It also reads rendered PR sidebar and timeline markup
to hide selected sections and known metadata events.
File identifiers stay in the tab's memory until the page is reloaded or closed.
GitHide stores only your display preferences (`hideGenerated`, `hideLabels`,
`hideProjects`, `hideMilestone`, `hideDevelopment`, `hideNotifications`, and
`hideActivity`, each true or false)
in the extension's local browser storage so it persists across reloads and PRs.
These preferences are shared with your other open GitHub tabs, but are not synced
to other devices or sent to a server. It is cleared when you remove the extension.

GitHide does not collect, transmit, sell, or share personal information,
repository content, browsing history, credentials, or other user data. It makes
no network requests and includes no analytics, advertising, or remote code.

## Site access

The extension runs on `https://github.com/*` so that it can follow GitHub's
navigation into a pull request without requiring a full page reload. It only
adds display controls and hides selected content on pull request conversation
and Files changed pages.
It does not change repository files, submit reviews, or mark files as viewed.

## Contact

Questions or concerns can be reported at
[GitHide issues](https://github.com/kerak19/githide/issues).
Please do not include private repository content or credentials in public issues.
