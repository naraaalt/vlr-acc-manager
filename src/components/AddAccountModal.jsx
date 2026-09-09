import { useState } from 'react';
import { Icon } from './Icons.jsx';

export default function AddAccountModal({ tcno, onCapture, onManualAdd, onImport, onClose }) {
  const [label, setLabel] = useState('');
  const [savingMode, setSavingMode] = useState(null);
  const [error, setError] = useState(null);
  const saving = savingMode !== null;
  const submit = async (event) => {
    event.preventDefault(); setSavingMode('current'); setError(null);
    try { await onCapture(label); onClose(); } catch (requestError) { setError(requestError.message); } finally { setSavingMode(null); }
  };
  const addManually = async () => {
    if (!label.trim()) { setError('Enter a label before adding an account manually.'); return; }
    setSavingMode('manual'); setError(null);
    try { await onManualAdd(label); onClose(); } catch (requestError) { setError(requestError.message); } finally { setSavingMode(null); }
  };
  const importAccounts = async () => {
    setSavingMode('import'); setError(null);
    try { await onImport(tcno.accounts.map((account) => account.id)); onClose(); } catch (requestError) { setError(requestError.message); } finally { setSavingMode(null); }
  };
  return (
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="add-account-title">
      <div className="dialog-head">
        <span style={{ color: 'var(--red)' }}>▚</span>ADD ACCOUNT<span className="spacer">ESC TO CANCEL</span>
        <button type="button" className="ghost-btn" onClick={onClose} disabled={saving} aria-label="Close"><Icon name="close" /></button>
      </div>
      <form onSubmit={submit} className="acct-form">
        <label htmlFor="account-label">LABEL</label>
        <input id="account-label" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. MAIN" maxLength="64" autoFocus disabled={saving} required />
        <p className="form-note">Snapshots the Riot Client session currently signed in on this PC. Credentials never leave this machine.</p>
        <div className="add-account-actions">
          <button type="submit" className="primary-btn" disabled={saving}><Icon name="import" />{savingMode === 'current' ? 'SAVING…' : 'SAVE CURRENT ACCOUNT'}</button>
          <button type="button" className="ghost-btn" onClick={addManually} disabled={saving}><Icon name="swap" />{savingMode === 'manual' ? 'WAITING FOR SIGN-IN…' : 'ADD MANUALLY'}</button>
        </div>
        <p className="form-note dim">Closes Riot Client and Valorant, then opens the Riot sign-in screen. Sign in to the account you want; it saves automatically.</p>
      </form>
      {tcno.available && tcno.accounts.length > 0 && (
        <section className="tcno-import">
          <div className="panel-label"><span>TCNO ACCOUNT SWITCHER</span></div>
          <p className="form-note">{tcno.accounts.length} saved account{tcno.accounts.length === 1 ? '' : 's'} detected.</p>
          <button type="button" className="ghost-btn" onClick={importAccounts} disabled={saving}><Icon name="import" />IMPORT DETECTED ACCOUNTS</button>
        </section>
      )}
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
