# Sapphire

A Windows Electron desktop app for viewing the daily Valorant store across saved Riot Client accounts. It presents a keyboard-first terminal-style dashboard showing the current store, Riot ID, account level, competitive rank, RR, and the time remaining before the store refreshes.

## Screenshots

Saved accounts on the left, the daily store for the selected one on the right:

![Accounts and the daily store](docs/screenshots/main.png)

Every setting, plus the running version and the update check:

![Settings](docs/screenshots/settings.png)

## Features

- Terminal-style dashboard: dark panels, 1px borders, monospace type, dense but aligned data.
- View the daily store offers, including skin names, rendered art, and VP prices.
- Preview a skin's in-game video (upgrade levels and colour variants) in a modal, with a volume slider that persists across skins and restarts.
- Save multiple Riot Client account sessions locally and switch between them.
- View Riot ID, account level, competitive rank, RR, and placement progress.
- Refresh one account's market or refresh all saved accounts, rate-limited to one refresh per account per 30 seconds to avoid Riot throttling.
- Cause-specific error recovery: a locked file, an expired session, a network failure, and a duplicate session each get their own explanation and the action that actually fixes them.
- Accounts load progressively on startup (one at a time, with a progress readout) instead of firing every store request at once.
- The signed-in account is always listed first, in every sort mode, and that survives a restart as long as its session token is valid. The remaining accounts can be ordered by name, level or rank with [O].
- Windows notification when the daily store rotates (00:00 UTC / 07:00 WIB): new offers are announced and the accounts sync automatically. Clicking the notification brings the window forward.
- Open a focused market page for an individual account.
- Hide skin previews when you only need account details; the choice persists across restarts.
- Save the current Riot Client login or open Riot Client and save a newly signed-in account automatically.
- Import detected account snapshots from TCNO Account Switcher.
- Resizable window with custom window controls, F11 fullscreen, and an automatic re-sync after the machine wakes from sleep.

## For end users

Use one of the Windows executables created by `npm run package:win`; no terminal is required after packaging.

- Run `Sapphire Setup <version>.exe` to install the app and optionally create desktop and Start Menu shortcuts.
- Run `Sapphire <version>.exe` for a portable version that does not need installation.

After the first install, updates come from inside the app — see [Updates](#updates). The installer
only has to be run by hand once.

The application uses a custom window without the default File/Edit/View/Window menu bar.

Saved accounts live in `%APPDATA%\valorant-account-manager` and stay there across upgrades: the app pins that path explicitly so the folder name is unaffected by the product rename.

## Requirements

- Windows 10 or later
- Node.js current LTS release
- npm
- Riot Client and Valorant installed in the default Riot Games location
- An internet connection

The Riot Client must be running and signed in before the app can read a current account session.

## Setup

1. Clone or download this repository.

2. Open PowerShell in the project directory.

3. Install dependencies:

   ```powershell
   npm install
   ```

4. Start the development app:

   ```powershell
   npm run dev
   ```

This starts Vite and Electron together. Changes to the renderer source are refreshed during development.

## Production-style launch

Build the renderer first:

```powershell
npm run build
```

Then launch Electron:

```powershell
npm start
```

## Create Windows executables

Create a distributable installer and portable executable:

```powershell
npm run package:win
```

The generated files are placed in the `release` folder:

- `Sapphire Setup <version>.exe` is the installer. It can create Start Menu and desktop shortcuts, so users do not need to open a terminal.
- `Sapphire <version>.exe` is the portable executable that can be run without installation.

Only the installer needs to be published for in-app updates to work; the portable build is for
keeping a copy that does not need installation. See [Publishing a release](#publishing-a-release).

Windows may show a SmartScreen warning for an unsigned personal application. This is expected until the executable is code-signed.

## Verify the project

Run every gate at once:

```powershell
npm run verify
```

Individually:

```powershell
npm run check   # syntax-check the Electron main-process files
npm run bridge  # diff renderer bridge calls against the preload bridge
npm run lint    # ESLint (unresolved identifiers, unused vars, hook rules)
npm test        # unit tests
npm run build   # production renderer build
```

`npm run bridge` and `npm run lint` cover the two ways a call can fail silently at runtime while every other gate stays green.

`npm run bridge` compares every method the renderer calls on `window.valorant` against what `contextBridge.exposeInMainWorld` actually exposes. A method that was never exposed throws `is not a function` only in the packaged app: the dev mock in `src/devMock.js` implements a superset of the real preload, so the preview looks perfectly healthy. It also reports the opposite direction — exposed but never called — as dead surface.

`npm run lint` catches identifiers that do not resolve, which otherwise build cleanly and only fail at runtime inside an event listener — a typo'd call there throws and takes the whole keyboard shortcut map down with no visible symptom.

`npm run lint:summary` prints the same results grouped by rule, which is easier to triage when there are several.

Create a production renderer build:

```powershell
npm run build
```

## Adding an account

1. Open Riot Client and sign in to the account you want to save.
2. In the app, select **Add account**.
3. Enter a label for the saved account.
4. Choose one of the following:
   - **Save current account** saves the session that is already active in Riot Client.
   - **Add manually** closes Riot Client and Valorant, opens the Riot sign-in screen, and saves the account automatically after you sign in. The current local session is securely backed up first.

You can also import account snapshots detected from TCNO Account Switcher.

## Using saved accounts

- **Switch to this account** restores the saved Riot Client session and opens Riot Client.
- **Refresh market** refreshes only that account's store, rank, and level. Manual refreshes are rate-limited to one per account per 30 seconds; pressing again inside the cooldown reports the remaining wait instead of sending the request.
- **View market** opens a larger store-only view for the account.
- **Hide skins** collapses the offer previews while keeping account details visible.

When an account fails to load, the overview panel explains the specific cause and offers the action that fixes it — a locked local file asks you to close Riot Client and retry, an expired session offers **Switch account**, a network failure points at Riot's status page, and a duplicate session offers **Delete entry**.

## Settings

Open the panel with the button next to the app name in the header. It is keyboard-navigable like the
rest of the app: `↑`/`↓` to move, `Enter` or `←`/`→` to change the focused row, `Esc` to close.

| Setting | What it does |
| --- | --- |
| STORE ROTATION NOTICE | Windows notification when the daily store resets at 00:00 UTC. |
| AUTO-SYNC ON ROTATION | Pull every saved account automatically when the store resets. |
| CONFIRM SWITCH & DELETE | Ask before restarting Riot Client or deleting a saved account. Turning it off removes a safeguard, which is why it is the one setting that defaults to being protective. |
| REOPEN LAST ACCOUNT | Reopen the account you were viewing last, instead of the signed-in one. |
| CHECK UPDATES ON LAUNCH | One small request to GitHub when the app starts. CHECK NOW works either way. |

A row that differs from its default is marked in blue and carries a `↺` button that resets just that
row. Preferences are stored locally under a single key; nothing is sent anywhere.

The panel holds only settings with **no other home**. Skin previews (`H`), account sort (`O`) and the
showcase volume all already have a keyboard shortcut or an in-context control, so they are not
duplicated here — one value offered in two places is how the two end up disagreeing.

The last row, **SYSTEM**, shows the running version and the update state, with **CHECK NOW** to ask
GitHub immediately.

## Updates

Install once, then the app updates itself: it reads the latest GitHub Release for this repository and
compares it against the running version. The pill in the header when one is available, and the
confirmation it opens:

![Update available](docs/screenshots/update.png)

![Update confirmation](docs/screenshots/update-dialog.png)

- **Checking.** Once per launch, a few seconds after the window appears, unless CHECK UPDATES ON
  LAUNCH is off. It is one small request, and it stays silent when it fails — being offline is not
  worth an error message. Pressing **CHECK NOW** reports the result either way.
- **Being told.** When a newer version exists a pill appears in the header, `UPDATE 0.1.3`. The `×`
  beside it dismisses the notice until the next launch. It does **not** skip the version, so a stray
  click cannot hide an update forever, and the SYSTEM row keeps showing the available version either
  way — what is dismissed is the nag, not the fact.
- **Updating.** The pill asks for confirmation, downloads the installer while showing progress, and
  checks it against the SHA-256 GitHub publishes alongside the release. Only then does the app close,
  run the installer silently, and start again. Saved accounts and sessions are untouched: they live
  in `%APPDATA%\valorant-account-manager`, which the installer never writes to.

The checksum proves the download arrived intact. It is **not** proof of authenticity — anyone able to
replace a release asset could replace its digest too. That is a consequence of the app being unsigned,
and it is worth knowing rather than glossing over. A release with no published digest is refused
rather than run unverified.

### Publishing a release

A new version needs exactly one asset: the installer that `npm run package:win` produces.

```powershell
npm version patch --no-git-tag-version   # or edit "version" in package.json by hand
npm run package:win
git tag v0.1.3
git push origin main --tags
```

Attach `release\Sapphire Setup 0.1.3.exe` to a GitHub Release with the matching tag (`v0.1.3`), and
publish it as a normal release — prereleases and drafts are ignored by the updater, since both mean
"not for everyone yet". The portable build does not need to be attached: the in-app updater runs the
installer, and the portable is built locally anyway.

## Keyboard shortcuts

The app is keyboard-first; the same list is visible in the **Commands** panel in the sidebar.

| Key | Action |
| --- | --- |
| `↑` / `↓` | Move between saved accounts |
| `←` / `→` | Move between the daily store offers |
| `Enter` | Open the market view for the selected account |
| `S` | Switch to the selected account |
| `R` | Refresh the selected account |
| `Ctrl+R` | Refresh all accounts |
| `P` | Preview the selected skin's video |
| `H` | Show or hide skin previews |
| `O` | Cycle the account sort order |
| `M` | Toggle the market view |
| `A` | Add an account |
| `X` | Delete the selected account |
| `I` | Import detected TCNO accounts (when available) |
| `Esc` | Close the open panel or preview |
| `F11` | Toggle fullscreen |
| `Q` | Quit |

## Security and privacy

This app is intended for your own Riot accounts on your own Windows computer.

- Riot Client session snapshots are stored with Electron's operating-system-backed encryption (`safeStorage`).
- Authentication tokens remain in the Electron main process and are not exposed to the React renderer.
- The app does not ask for Riot usernames or passwords.
- Account switching writes saved Riot Client `Data` and `Config` snapshots back to the local Riot Client directory. Close Valorant before switching and avoid using this with accounts you do not own.
- Never commit generated account data, session files, `.env` files, or `node_modules` to Git. The included `.gitignore` excludes these paths.

## Limitations

- This project depends on Riot Client local endpoints and Valorant service endpoints that may change without notice.
- Store, rank, level, and account data are available only while the related Riot session remains valid.
- Riot Client must be installed in `C:\Riot Games\Riot Client` for automatic launch and switching.
- In-app updates verify a checksum published with the release, which shows the download arrived intact but does not prove where it came from. The installers are unsigned; see [Updates](#updates).
- This project is unofficial and is not affiliated with or endorsed by Riot Games.

## Project scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run Vite and Electron for development. |
| `npm run build` | Build the React renderer into `dist`. |
| `npm run package:win` | Build Windows installer and portable `.exe` files in `release`. |
| `npm start` | Open Electron using the built renderer. |
| `npm run check` | Check Electron JavaScript files for syntax errors. |
| `npm run bridge` | Diff renderer `window.valorant.*` calls against the preload bridge. |
| `npm run lint` | Lint the whole project with ESLint. |
| `npm run lint:summary` | Print lint results grouped by rule. |
| `npm run css:dead` | List class selectors in `styles.css` that nothing references. |
| `npm run js:dead` | List exported names that no other file references. |
| `npm test` | Run the unit tests (Vitest) once. |
| `npm run test:watch` | Run the unit tests in watch mode. |
| `npm run verify` | Run check, lint, tests and build in one go. |
