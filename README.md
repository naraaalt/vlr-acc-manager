# Valorant Account Manager

A Windows Electron desktop app for viewing the daily Valorant store across saved Riot Client accounts. It can show the current store, Riot ID, account level, competitive rank, RR, and the time remaining before the store refreshes.

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

## Verify the project

Run the JavaScript syntax checks:

```powershell
npm run check
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
   - **Add manually** opens Riot Client and waits for you to sign in to a different account, then saves it automatically.

You can also import account snapshots detected from TCNO Account Switcher.

## Using saved accounts

- **Switch to this account** restores the saved Riot Client session and opens Riot Client.
- **Refresh market** refreshes only that account's store, rank, and level.
- **View market** opens a larger store-only view for the account.
- **Hide skins** collapses the offer previews while keeping account details visible.

If a saved API session expires, switch to that account and use **Save current login** to capture a fresh session.

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
| `npm start` | Open Electron using the built renderer. |
| `npm run check` | Check Electron JavaScript files for syntax errors. |
