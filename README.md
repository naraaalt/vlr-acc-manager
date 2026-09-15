# Sapphire

A Windows Electron desktop app for viewing the daily Valorant store across saved Riot Client accounts. It presents a keyboard-first terminal-style dashboard showing the current store, Riot ID, account level, competitive rank, RR, and the time remaining before the store refreshes.

## Features

- Terminal-style dashboard: dark panels, 1px borders, monospace type, dense but aligned data.
- View the daily store offers, including skin names, rendered art, and VP prices.
- Preview a skin's in-game video (upgrade levels and colour variants) in a modal, with a volume slider that persists across skins and restarts.
- Save multiple Riot Client account sessions locally and switch between them.
- View Riot ID, account level, competitive rank, RR, and placement progress.
- Refresh one account's market or refresh all saved accounts, rate-limited to one refresh per account per 30 seconds to avoid Riot throttling.
- Cause-specific error recovery: a locked file, an expired session, a network failure, and a duplicate session each get their own explanation and the action that actually fixes them.
- Accounts load progressively on startup (one at a time, with a progress readout) instead of firing every store request at once.
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

Windows may show a SmartScreen warning for an unsigned personal application. This is expected until the executable is code-signed.

## Verify the project

Run the JavaScript syntax checks:

```powershell
npm run check
```

Run the unit tests:

```powershell
npm test
```

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
- This project is unofficial and is not affiliated with or endorsed by Riot Games.

## Project scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run Vite and Electron for development. |
| `npm run build` | Build the React renderer into `dist`. |
| `npm run package:win` | Build Windows installer and portable `.exe` files in `release`. |
| `npm start` | Open Electron using the built renderer. |
| `npm run check` | Check Electron JavaScript files for syntax errors. |
| `npm test` | Run the unit tests (Vitest) once. |
| `npm run test:watch` | Run the unit tests in watch mode. |
