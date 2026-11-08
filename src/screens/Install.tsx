import { useEffect, useState } from 'react';
import { LangToggle, useLang } from '../i18n';
import { iosSupportsPush, iosVersion } from '../lib/platform';
import { Icon } from '../components/Icon';

export function InstallIOS() {
  const { t } = useLang();
  const ua = navigator.userAgent;
  const v = iosVersion(ua);
  return (
    <main className="screen">
      <LangToggle />
      <img src="/icons/icon-192.png" alt="" className="logo" />
      <h1>{t('installTitle')}</h1>
      <p>{t('installWhy')}</p>
      {v && !iosSupportsPush(ua) && <p className="warn">{t('iosOld', { version: `${v[0]}.${v[1]}` })}</p>}
      <ol className="steps">
        <li>
          <strong>{t('iosStep1')}</strong>
          <br /><small>{t('iosStep1Hint')} <ShareIcon /></small>
        </li>
        <li><strong>{t('iosStep2')}</strong></li>
        <li><strong>{t('iosStep3')}</strong></li>
        <li><strong>{t('iosStep4')}</strong></li>
      </ol>
      <div className="arrow-down"><Icon name="down" size={32} /></div>
    </main>
  );
}

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function InstallAndroid({ onSkip }: { onSkip: () => void }) {
  const { t } = useLang();
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPromptEvent); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    if ((await prompt.userChoice).outcome === 'accepted') setInstalled(true);
    setPrompt(null);
  };

  return (
    <main className="screen">
      <LangToggle />
      <img src="/icons/icon-192.png" alt="" className="logo" />
      <h1>{t('installTitle')}</h1>
      <p>{t('installWhy')}</p>
      {installed ? (
        <p className="ok">{t('androidThenOpen')}</p>
      ) : prompt ? (
        <button className="button" onClick={install}>{t('installButton')}</button>
      ) : (
        <p className="card">{t('androidManual')} {t('androidThenOpen')}</p>
      )}
      <button className="link" onClick={onSkip}>{t('continueBrowser')}</button>
    </main>
  );
}

function ShareIcon() {
  return (
    <svg className="share-icon" viewBox="0 0 24 24" width="22" height="22" aria-label="Share" role="img">
      <path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 11v9h12v-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
