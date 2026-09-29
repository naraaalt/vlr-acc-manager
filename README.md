# Sapphire

A Windows desktop app for viewing the daily Valorant store across saved Riot Client accounts: a keyboard-first terminal-style dashboard showing the current store, Riot ID, account level, rank, RR, and the time until the store refreshes.

![Accounts on the left, the daily store for the selected one on the right](docs/screenshots/main.png)

## Features

- Daily store for every saved account: skin names, rendered art, VP prices, and a countdown to the rotation.
- Every offer is framed in its skin's tier colour, so the tier reads at a glance without a label.
- Night Market, when Riot is running one: that account's six discounted offers, sorted by tier and then by discount, each drawn in its own tier colour and marked once opened.
- Featured bundles, when Riot is selling one or two: each bundle's key art, its own discount and countdown, and every item inside it — weapon skins, melee, buddy, spray and player card — each with its own price, its tier colour where it has one, and the showcase video behind a **PREVIEW** button. When two are on sale, a tab per bundle switches between them; each keeps its own end date, because Riot runs them on different clocks.
- Skin previews — upgrade levels and colour variants — in a modal, with a volume slider that persists across skins and restarts.
- Riot ID, account level, competitive rank, RR and placement progress, per account.
- Save and switch Riot Client sessions, or import them from TCNO Account Switcher.

## Installation

Download [`Sapphire Setup <version>.exe`](releases) and run it. That installer is the only asset a release carries: the portable build is produced by `npm run package:win` but is not published, because the updater only ever runs the installer and two 96 MB assets per release is a cost with no reader.

> Windows may show a SmartScreen warning: the installer is not code-signed. After that, updates come from inside the app ([Updates](#updates)), and saved accounts in `%APPDATA%\valorant-account-manager` survive them.

## Usage

1. **Add an account.** Sign in to the account in Riot Client, then select **Add account** (`A`) and give it a label.
   - **Save current account** saves the session that is already active.
   - **Add manually** closes Riot Client and Valorant, opens Riot's sign-in screen, and saves the account once you sign in. The current local session is backed up first.
   - Snapshots detected from TCNO Account Switcher can be imported as well (`I`).
2. **Pick an account** with `↑`/`↓` (or `O` to change the sort order); the daily store for that account fills the panel on the right. Point at an offer by hovering it or with `←`/`→`. Nothing is pointed at until you do — the header reads `SELECTED —/06` — and pointing at one names it there.
3. **Refresh it** with `R`, or every account with `Ctrl+R`.
4. **Open the market view** with `M` — the store on its own, larger. `H` collapses the offer previews.
5. **Preview a skin** with `P`, which plays the in-game video of the offer you are pointing at. The cards are not buttons: the only thing to click inside one is its **PREVIEW** button.
6. **Open the Night Market** when Riot is running one — a `NIGHT MARKET VIEW` entry appears in the `STORE REFRESHES IN` row, and lists that account's discounted offers. `Esc` goes back.
7. **Open the Featured Bundle** when Riot is selling one — an entry in the same row carries the bundle's name and its discount, and `B` opens it too. Riot usually runs a promo bundle alongside the main one, so there is still only **one** entry: a `+1` beside the discount says another bundle is on sale, and the page carries a tab per bundle to switch between them (`[` / `]` step through them). Items whose price is included in the bundle read `INCLUDED` rather than `0 VP`; items with showcase video carry a **PREVIEW** button. `Esc` goes back.
8. **Switch the Riot session to an account** with `S`, or with a row's own **SWITCH** button: the saved session is restored and Riot Client opens. The account you switched to becomes the selected one — the details panel and the daily store below it describe that account, not the one you came from — and a store page that is already open follows it too, so nothing on screen keeps describing a session you are no longer signed into.

Riot Client must be running and signed in before the app can read a session. Its install location does not matter: Sapphire reads where this PC put it, so another drive is fine.

## Keyboard shortcuts

The app is keyboard-first. The **Commands** panel in the sidebar carries the ones that are not already written next to their own control — it is a subset, not the whole map; the table below is the whole map.

| Key | Action |
| --- | --- |
| `↑` / `↓` | Move between saved accounts |
| `←` / `→` | Point at a daily store offer |
| `Enter` | Open the market view for the selected account |
| `S` | Switch to the selected account |
| `R` | Refresh the selected account |
| `Ctrl+R` | Refresh all accounts |
| `P` | Preview the video of the offer you are pointing at |
| `H` | Show or hide skin previews |
| `O` | Cycle the account sort order |
| `M` | Toggle the market view |
| `B` | Toggle the featured bundle page |
| `[` / `]` | Step between bundles, when Riot is selling more than one |
| `A` | Add an account |
| `X` | Delete the selected account |
| `I` | Import detected TCNO accounts (when available) |
| `Esc` | Close the open panel or preview |
| `F11` | Toggle fullscreen |
| `Q` | Quit, after a confirmation |

`Enter` and `M` both open the market view; `Enter` closes the bundle and Night Market pages on its way, so pressing it from either of them lands on the store rather than appearing to do nothing.

## Settings

Open the panel with the button next to the app name in the header. `↑`/`↓` move, `Enter` or `←`/`→` change the focused row, `Esc` closes.

| Setting | What it does |
| --- | --- |
| STORE ROTATION NOTICE | Windows notification when the daily store resets at 00:00 UTC. On by default. |
| AUTO-SYNC ON ROTATION | Pull every saved account automatically when the store resets. On by default. |
| NIGHT MARKET NOTICE | One Windows notification when a Night Market opens for a saved account. On by default. |
| CONFIRM SWITCH & DELETE | Ask before restarting Riot Client or deleting a saved account. On by default. |
| REOPEN LAST ACCOUNT | Select the account you were viewing last, instead of the signed-in one. Off by default. |
| CHECK UPDATES ON LAUNCH | One small request to GitHub when the app starts. `CHECK NOW` works either way. On by default. |

A row that differs from its default is marked in blue and carries a `↺` that resets just that row. Preferences are stored locally; nothing is sent anywhere.

Four preferences live outside this panel, next to the thing they change: **HIDE SKIN PREVIEWS** is the `H` key, **ACCOUNT SORT** is the `O` key and the sidebar's sort button, and **SHOWCASE SOUND** / **SHOWCASE VOLUME** are the buttons on the showcase overlay itself. They persist exactly like the rows above.

The last row, **SYSTEM**, shows the running version and the update state, with **CHECK NOW**.

![Every setting, plus the running version and the update check](docs/screenshots/settings.png)

## Updates

Install once; after that the app updates itself from this repository's GitHub Releases. A newer version puts a pill in the header, and the confirmation it opens:

![Update available](docs/screenshots/update.png)

![Update confirmation](docs/screenshots/update-dialog.png)

The `×` hides the notice for the session only and never skips the version, so the SYSTEM row in settings keeps showing it. Saved accounts and sessions are untouched by an update. The download is checked against the SHA-256 published with the release before it runs — that shows the file arrived intact, not who published it, since the installers are unsigned. A release with no digest is refused.

### Where the space goes

An installer leaves its own scratch behind: the payload it unpacks, the executable it moves aside when replacing one, and a copy of itself. Measured on one machine after four updates, that had accumulated to **2.1 GB**.

An in-app update is the common case and adds about **300 MB** — the moved-aside executable (216 MB) plus the installer's own cached copy (96 MB). The larger shapes come from a full install and from the portable build, both of which unpack the whole payload; a machine that only ever updates in place does not see them.

Sapphire sweeps all of it on every launch. Nothing to run and nothing to configure; the first launch after installing this version reclaims whatever earlier updates left, and every launch after that keeps it at zero.

Two delays are deliberate. A directory is left alone for its first ten minutes, because an installer sitting on its "choose a folder" prompt is holding its scratch open and looks exactly like a leftover. A downloaded installer is left for an hour, because a failed install is retried from that file. Both are then collected on a later launch.

Only directories that are provably Sapphire's are touched — the check reads this build's own `app-update.yml` inside them, or the executable NSIS moved aside when it matches the one Sapphire is running as. Another Electron app's scratch, which looks identical, is left alone.

### Publishing a release

One asset: the installer. Attach it to a normal release — drafts and prereleases are ignored by the updater, and the portable build is not needed.

```powershell
npm version patch --no-git-tag-version    # 0.2.1 -> 0.2.2
npm run package:win
git tag v0.2.2
git push origin main --tags
```

Then create the release for that tag with `release\Sapphire Setup 0.2.2.exe` attached, and name the tag `v<version>` so the updater's version comparison sees it.

Upload it through GitHub's release UI or API rather than by pasting the file anywhere else: GitHub records the SHA-256 of what it stores, and the updater refuses a release whose asset has no digest — so an asset that arrives without one silently stops offering the update.

Two failure modes worth knowing, because both are quiet:

- **A version that does not increase is invisible.** The updater compares numerically, so `0.2.10` is correctly newer than `0.2.9` — but re-uploading a *rebuilt* `0.2.1` over an existing `0.2.1` reaches nobody, because `0.2.1` is not newer than `0.2.1`. Ship a new version instead.
- **An asset whose name does not match is ignored.** The updater looks for `Sapphire Setup <version>.exe` (with the spaces GitHub turns into dots, which it accepts too). A release with only the portable build attached reads as "no installer" and stops offering the update.

## Development

Needs Windows 10+, Node.js LTS, npm, and Riot Client with Valorant installed.

```powershell
npm install
npm run dev      # Vite + Electron; renderer changes reload live
```

For a production-style run instead, `npm run build` then `npm start`. `npm run package:win` writes the installer and portable `.exe` into `release`.

### Checks

```powershell
npm run verify
```

Runs all five gates; each is also available on its own.

| Command | Purpose |
| --- | --- |
| `npm run check` | Syntax-check the Electron main-process files. |
| `npm run bridge` | Diff renderer bridge calls against the preload bridge. |
| `npm run lint` | ESLint, with `lint:summary` to group results by rule. |
| `npm test` | Unit tests, once (`test:watch` to watch). |
| `npm run build` | Production renderer build. |

`css:dead` and `js:dead` list unreferenced class selectors and exports.

`bridge` and `lint` cover the two ways a call can fail silently at runtime while every other gate stays green. `bridge` catches a renderer call to a method the preload never exposed — it throws only in the packaged app, because the dev mock implements a superset of the real preload. `lint` catches identifiers that do not resolve, which otherwise fail inside an event listener and take the whole keyboard shortcut map down with no visible symptom.

## Security and privacy

This app is intended for your own Riot accounts on your own Windows computer.

- Session snapshots are stored with Electron's OS-backed encryption (`safeStorage`). Authentication tokens stay in the main process and are never exposed to the renderer.
- The app never asks for your Riot username or password.
- Switching writes saved Riot Client `Data` and `Config` snapshots back to the local Riot Client directory. Close Valorant before switching, and do not use this with accounts you do not own.

## Limitations

- Depends on Riot Client and Valorant service endpoints that may change without notice. Store, rank and level data are available only while the session stays valid.
- Updates are checksum-verified, but the installers are unsigned, so the download's origin is not authenticated; see [Updates](#updates).
- Unofficial project, not affiliated with or endorsed by Riot Games.
