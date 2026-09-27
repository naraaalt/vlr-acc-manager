import { beforeEach, describe, expect, it, vi } from 'vitest';

// switcher.js imports electron's app/safeStorage and reads the Riot install root AT IMPORT TIME, so
// every dependency that touches the machine is stubbed and the module graph is rebuilt per test — the
// real thing cannot run here: a switch writes credentials and relaunches Riot Client.
//
// What this pins is the SHAPE the renderer depends on. It gates its page retarget on `moved`, so a
// switch that succeeds must carry it just as much as one whose store-read failed; the failure branch
// alone would not catch a success path that dropped the field, and that is the most common path.
const state = vi.hoisted(() => ({ userData: '', riotRoot: '' }));

vi.mock('electron', () => ({
  app: { getPath: () => state.userData },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(`enc:${value}`),
    decryptString: (buffer) => buffer.toString().replace(/^enc:/, '')
  }
}));

// The Riot root has to be a real path assertWithinRiotRoot accepts: `const riotRoot =
// getRiotClientRoot()` runs at import time and every write goes through it.
const accountStore = vi.hoisted(() => ({
  getRiotClientRoot: () => state.riotRoot,
  loadAccount: vi.fn(),
  // An array, not a function: switcher.js iterates it to decide which files a credential bundle owns.
  managedPaths: ['Data/RiotClientSettings.yaml', 'Data/RiotGamesApi.dll'],
  captureLiveCredentials: vi.fn()
}));

vi.mock('./accountStore.js', () => accountStore);
vi.mock('./accountService.js', () => ({
  // false so planPlay decides 'switch-then-launch': PLAY only calls performSwitch when the account is
  // not already signed in, and this case is about the switch's throw reaching PLAY.
  isAccountLive: vi.fn(async () => false),
  refreshSwitchedAccount: vi.fn()
}));
vi.mock('./riotClient.js', () => ({
  isValorantRunning: vi.fn(async () => false),
  launchRiotClient: vi.fn(async () => {}),
  launchValorantWhenReady: vi.fn(async () => {})
}));
// closeRiotProcesses shells out to taskkill; the fs calls are left real so the switch writes into the
// scratch directory rather than a fake filesystem.
vi.mock('node:child_process', () => ({
  execFile: (file, args, options, callback) => {
    const done = typeof options === 'function' ? options : callback;
    if (done) done(null, '', '');
    return { on: () => {} };
  }
}));

// The shape writeBundle expects: `path` relative to the Riot root (assertWithinRiotRoot rejects
// anything outside it) and `content` as base64, which is what captureLiveCredentials emits.
const CREDENTIALS = { version: 1, files: [{ path: 'Data/foo', content: 'AAAA' }] };

async function loadSwitcher() {
  // switchInProgress is module-level state, so a fresh graph per test is also what keeps a later case
  // from tripping the re-entrancy guard. The mocks are configured here rather than in beforeEach
  // because resetModules re-imports them: a value set before the reset would not survive.
  vi.resetModules();
  accountStore.loadAccount.mockReset();
  accountStore.loadAccount.mockResolvedValue({ label: 'main', id: 'id-main', credentials: CREDENTIALS });
  const service = await import('./accountService.js');
  service.refreshSwitchedAccount.mockReset();
  return { switcher: await import('./switcher.js'), service };
}

beforeEach(async () => {
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const path = (await import('node:path')).default;
  const root = mkdtempSync(path.join(tmpdir(), 'switcher-test-'));
  state.userData = root;
  state.riotRoot = root;
});

describe('switchToAccount', () => {
  it('reports a completed move, with moved:true, when the store refreshes', async () => {
    // The path the user takes almost every time. `moved` has to be here: the renderer retargets the
    // open store page on it, so dropping it stops the page following a switch that worked.
    const { switcher, service } = await loadSwitcher();
    service.refreshSwitchedAccount.mockResolvedValue({ store: { accountName: 'main' } });

    const result = await switcher.switchToAccount('main');

    expect(result).toEqual({ label: 'main', store: { accountName: 'main' }, moved: true, refreshError: null });
  });

  it('still reports the move when the store read fails after the launch', async () => {
    // A slow sign-in runs past waitForCurrentAccount's 60-second window, but the credentials are
    // written and the client relaunched by then — the session HAS moved. Reporting that as a failed
    // switch left the preview on the old account while the session had really changed.
    const { switcher, service } = await loadSwitcher();
    service.refreshSwitchedAccount.mockRejectedValue(new Error('Riot did not finish signing in within 60 seconds.'));

    const result = await switcher.switchToAccount('main');

    expect(result.moved).toBe(true);
    expect(result.store).toBeNull();
    expect(result.label).toBe('main');
    expect(result.refreshError).toMatch(/60 seconds/);
  });

  it('does NOT claim a move when the failure happens before the client is touched', async () => {
    // loadAccount and backupLiveCredentials run before writeBundle, so a failure there means the
    // session never moved. Claiming `moved` for it would retarget the page to an account the client
    // is not signed in as — worse than not moving it at all.
    const { switcher, service } = await loadSwitcher();
    accountStore.loadAccount.mockRejectedValue(new Error('No saved account “ghost”.'));
    service.refreshSwitchedAccount.mockResolvedValue({ store: null });

    await expect(switcher.switchToAccount('ghost')).rejects.toThrow(/No saved account/);
  });

  it('leaves PLAY the throwing behaviour it documents', async () => {
    // PLAY's guarantee is that a switch waits for the new session to be readable before returning, so
    // the launch is asked for as an account the client is signed in as. If performSwitch swallowed the
    // refresh failure, PLAY would launch against a client possibly sitting at Riot's sign-in screen.
    const { switcher, service } = await loadSwitcher();
    service.refreshSwitchedAccount.mockRejectedValue(new Error('not signed in'));

    await expect(switcher.playAccount('main')).rejects.toThrow(/not signed in/);
  });

  it('refuses a second switch while one is in progress', async () => {
    // Module-level state, and the reason each case rebuilds the graph: without the guard two switches
    // would write the credential bundle concurrently.
    const { switcher, service } = await loadSwitcher();
    let release;
    service.refreshSwitchedAccount.mockImplementation(() => new Promise((resolve) => { release = resolve; }));

    const first = switcher.switchToAccount('main');
    // The guard is set synchronously by the first call, so the second is refused without waiting for
    // the first to reach the refresh. Waiting for `release` to exist first keeps the assertion from
    // racing the first call's own async work.
    const second = switcher.switchToAccount('main');
    await expect(second).rejects.toThrow(/still in progress/);
    // Let the first finish so its promise does not leak into the next test.
    while (!release) await new Promise((resolve) => setTimeout(resolve, 0));
    release({ store: null });
    await first;
  });
});

describe('playAccount', () => {
  it('reports switched:true when the press moved the session first', async () => {
    // The renderer re-reads the dashboard and moves the selection on this flag — same rule as `moved`
    // above: PLAY leaves the account the user came from selected, so a dropped flag silently stops
    // the panel following the press.
    const { switcher, service } = await loadSwitcher();
    service.refreshSwitchedAccount.mockResolvedValue({ store: { accountName: 'main' } });

    const result = await switcher.playAccount('main');

    expect(result).toEqual({ label: 'main', launched: true, switched: true, reason: null });
  });

  it('reports switched:false when the account already owned the session', async () => {
    // Nothing moved, so the renderer must NOT re-read the dashboard or reselect a row: a launch on
    // the signed-in account is not a switch, and claiming one would move the selection away from
    // whatever the user was looking at.
    const { switcher, service } = await loadSwitcher();
    service.isAccountLive.mockResolvedValue(true);

    const result = await switcher.playAccount('main');

    expect(result).toEqual({ label: 'main', launched: true, switched: false, reason: null });
  });
});
