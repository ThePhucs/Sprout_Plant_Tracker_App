import { useState } from 'react';
import { LangToggle, useLang } from '../i18n';
import { isIOS } from '../lib/platform';

export function OpenInBrowser() {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const ios = isIOS(navigator.userAgent, navigator.maxTouchPoints);
  const browser = ios ? 'Safari' : 'Chrome';
  const url = location.href;
  // Android "intent" link asks the system to open this page in Chrome.
  const chromeIntent = `intent://${location.host}${location.pathname}${location.search}#Intent;scheme=https;package=com.android.chrome;end`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt(t('copyLink'), url); // older in-app browsers: let them copy by hand
    }
    setCopied(true);
  };

  return (
    <main className="screen">
      <LangToggle />
      <img src="/icons/icon-192.png" alt="" className="logo" />
      <h1>{t('inAppTitle')}</h1>
      <p>{t('inAppBody', { browser })}</p>
      <p className="card">{ios ? t('inAppStepsIOS') : t('inAppStepsAndroid')}</p>
      {!ios && <a className="button" href={chromeIntent}>{t('openChrome')}</a>}
      <button className={ios ? 'button' : 'button secondary'} onClick={copy}>{t('copyLink')}</button>
      {copied && <p className="ok">{t('copied', { browser })}</p>}
    </main>
  );
}
