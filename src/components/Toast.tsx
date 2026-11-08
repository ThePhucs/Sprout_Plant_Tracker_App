import { createContext, useContext, useRef, useState, type ReactNode } from 'react';

type Toast = { message: string; action?: { label: string; run: () => void } };
const ToastContext = createContext<(t: Toast) => void>(() => {});

/** One message at a time at the bottom of the screen, like an Android snackbar. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<number>(undefined);
  const show = (t: Toast) => {
    setToast(t);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), t.action ? 6000 : 3000);
  };
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-area" role="status" aria-live="polite">
        {toast && (
          <div className="toast">
            <span>{toast.message}</span>
            {toast.action && (
              <button className="toast-action" onClick={() => { setToast(null); toast.action!.run(); }}>
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
