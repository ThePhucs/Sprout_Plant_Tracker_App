import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLang } from '../i18n';

type Ask = { message: string; action: string; resolve: (ok: boolean) => void };
const ConfirmContext = createContext<(message: string, action: string) => Promise<boolean>>(async () => false);

/**
 * In-app confirmation sheet. Replaces the browser's confirm(), which shows the web address
 * and English buttons on many iPhones. Cancel is the big easy button; the risky one is red text.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [ask, setAsk] = useState<Ask | null>(null);
  const confirm = (message: string, action: string) =>
    new Promise<boolean>((resolve) => setAsk({ message, action, resolve }));
  const done = (ok: boolean) => { ask?.resolve(ok); setAsk(null); };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {ask && <Sheet ask={ask} onDone={done} />}
    </ConfirmContext.Provider>
  );
}

function Sheet({ ask, onDone }: { ask: Ask; onDone: (ok: boolean) => void }) {
  const { t } = useLang();
  const ref = useRef<HTMLDialogElement>(null);
  // <dialog>.showModal needs iOS 15.4+; older Safari shows it as a plain overlay.
  useEffect(() => { const d = ref.current; if (d?.showModal) d.showModal(); else d?.setAttribute('open', ''); }, []);
  return (
    <dialog ref={ref} className="sheet" onClose={() => onDone(false)} onClick={(e) => e.target === ref.current && onDone(false)}>
      <div className="sheet-body">
        <p>{ask.message}</p>
        <button className="button" autoFocus onClick={() => onDone(false)}>{t('cancel')}</button>
        <button className="button quiet-danger" onClick={() => onDone(true)}>{ask.action}</button>
      </div>
    </dialog>
  );
}

/** `if (!(await confirm('Xoá ảnh này?', 'Xoá'))) return;` */
export const useConfirm = () => useContext(ConfirmContext);
