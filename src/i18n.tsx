import { createContext, useContext, useState, type ReactNode } from 'react';
import { translate, type Lang, type StringKey } from '../shared/i18n';
import { ADMIN_NAME } from './config';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('lang');
    if (saved === 'vi' || saved === 'en') return saved;
  } catch { /* storage blocked */ }
  return navigator.language.toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: StringKey, v?: Record<string, string>) => string };
const LangContext = createContext<Ctx | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState(initialLang);
  const setLang = (l: Lang) => {
    setLangState(l);
    document.documentElement.lang = l;
    try { localStorage.setItem('lang', l); } catch { /* storage blocked */ }
  };
  const t: Ctx['t'] = (k, v) => translate(lang, k, { admin: ADMIN_NAME, ...v });
  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext)!;

export function LangToggle() {
  const { lang, setLang, t } = useLang();
  return (
    <button className="link lang-toggle" onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}>
      {t('switchLang')}
    </button>
  );
}
