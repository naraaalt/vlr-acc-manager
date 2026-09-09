import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icons.jsx';

const ConfirmContext = createContext(null);

// Promise-based confirm dialog styled like the app (replaces window.confirm,
// which renders a native Windows dialog that clashes with the TUI skin).
// Usage: const ok = await confirm({ title, body, confirmLabel, tone });
export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);
  const [focused, setFocused] = useState('confirm');

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolverRef.current = resolve;
    setFocused(options?.danger ? 'confirm' : 'confirm');
    setDialog({
      title: options?.title ?? 'CONFIRM',
      body: options?.body ?? '',
      confirmLabel: options?.confirmLabel ?? 'CONFIRM',
      cancelLabel: options?.cancelLabel ?? 'CANCEL',
      danger: Boolean(options?.danger)
    });
  }), []);

  const settle = useCallback((value) => {
    if (resolverRef.current) resolverRef.current(value);
    resolverRef.current = null;
    setDialog(null);
  }, []);

  useEffect(() => {
    if (!dialog) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); settle(false); }
      else if (event.key === 'Enter') { event.preventDefault(); settle(true); }
      else if (event.key === 'Tab') {
        event.preventDefault();
        setFocused((current) => (current === 'confirm' ? 'cancel' : 'confirm'));
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [dialog, settle]);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {dialog && (
        <div
          className="overlay open confirm-overlay"
          onClick={(event) => { if (event.target === event.currentTarget) settle(false); }}
          role="presentation"
        >
          <section className={`modal confirm-modal${dialog.danger ? ' danger' : ''}`} role="alertdialog" aria-modal="true" aria-label={dialog.title}>
            <div className="dialog-head">
              <span style={{ color: dialog.danger ? 'var(--red)' : 'var(--cyan)' }}>▚</span>
              {dialog.title}
              <span className="spacer">CONFIRM ACTION</span>
            </div>
            <p className="confirm-body">{dialog.body}</p>
            <div className="confirm-actions">
              <button
                type="button" className={`ghost-btn${focused === 'cancel' ? ' focused' : ''}`}
                onMouseEnter={() => setFocused('cancel')}
                onClick={() => settle(false)}
              >{dialog.cancelLabel}</button>
              <button
                type="button" className={`${dialog.danger ? 'danger-btn' : 'primary-btn'}${focused === 'confirm' ? ' focused' : ''}`}
                onMouseEnter={() => setFocused('confirm')}
                onClick={() => settle(true)}
              >{dialog.confirmLabel}</button>
            </div>
            <div className="confirm-foot">
              <span><Icon name="back" size={9} />[TAB]</span>
              <span>[ENTER] {dialog.confirmLabel}</span>
              <span>[ESC] {dialog.cancelLabel}</span>
            </div>
          </section>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  return context?.confirm ?? (async () => { console.warn('useConfirm outside provider'); return window.confirm?.('Confirm?') ?? false; });
}
