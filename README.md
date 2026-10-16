# GitHide

A tiny Chromium extension that adds **Hide generated files** to the toolbar in
GitHub's pull request **Files changed** tab (`/changes` and `/files`).

## Install in Brave, Chrome, or Edge

1. Clone this repository or download its ZIP and extract it.
2. Open `brave://extensions` (or `chrome://extensions` / `edge://extensions`).
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the folder containing `manifest.json`.
5. Refresh an existing GitHub tab, open a pull request's **Files changed** tab,
   and check **Hide generated files**.

No build or npm install is needed to use the extension.

Chrome Web Store publication is paused. Use the unpacked installation above.

## Behavior and privacy

- Starts unchecked on first use. Remembers your choice locally across reloads
  and PRs, and updates other open GitHub tabs when you toggle it.
- Shows the number of detected generated files hidden while checked. The count
  can grow as GitHub loads more diffs; it is not a total for the whole PR.
- Hides entire generated diff cards, including their headers, without marking
  them as viewed. Also hides their entries in the left file tree and folders
  whose loaded entries are all hidden. Unchecking restores them.
- Uses GitHub's generated-file notice; does not guess from filenames.
- Handles dynamically loaded diffs and navigation within GitHub. Once a file is
  recognized, it stays recognized in that view even after **Load Diff** is clicked.
- Leaves GitHub's review/file counts unchanged.
- Runs only on `github.com`. The host-wide match lets it handle navigation into
  a PR without reloading. It makes no network requests and uses no background
  service. The `storage` permission saves only your checkbox preference locally.
- GitHub Enterprise hosts and non-English generated notices are not supported.
  GitHub markup changes may require selector updates. A generated diff already
  loaded before this script starts may have no remaining generated notice.

## Development

Use Node.js 20.19+, 22.12+, or 24+:

```sh
npm ci
npm test
```

The runtime is plain JavaScript and CSS. jsdom is used only for tests.

## Store package

Create the upload ZIP from the repository root:

```sh
mkdir -p dist
zip -X dist/githide-1.0.0.zip manifest.json content.js content.css icons/*.png LICENSE
```

Only extension runtime files, icons, and the license go in the upload ZIP.
Store listing text and submission notes are in [store/LISTING.md](store/LISTING.md).

## License and privacy

GitHide is open source under the [MIT license](LICENSE).
See the [privacy policy](PRIVACY.md) for details of local page processing.
