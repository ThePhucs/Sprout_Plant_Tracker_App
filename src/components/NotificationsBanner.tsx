import { useState } from 'react';
import { useLang } from '../i18n';
import { navigate } from '../lib/router';
import { iosSupportsPush, isIOS, pushApiAvailable } from '../lib/platform';
import { Icon } from './Icon';

const HIDE_KEY = 'notifBannerHiddenUntil';
const HIDE_DAYS = 7;

/** Reminders are the point of the app, so nudge on Today until they're on; can be hidden for a week. */
export function NotificationsBanner() {
  const { t } = useLang();
  const [hidden, setHidden] = useState(() => {
    try { return Number(localStorage.getItem(HIDE_KEY)) > Date.now(); } catch { return false; }
  });
  const ua = navigator.userAgent;
  if (hidden || !pushApiAvailable() || (isIOS(ua, navigator.maxTouchPoints) && !iosSupportsPush(ua))) return null;
  if (Notification.permission === 'granted') return null;

  const hide = () => {
    try { localStorage.setItem(HIDE_KEY, String(Date.now() + HIDE_DAYS * 86_400_000)); } catch { /* storage blocked */ }
    setHidden(true);
  };
  const blocked = Notification.permission === 'denied';
  return (
    <div className="banner">
      <Icon name="bell" />
      <button className="banner-main" onClick={() => navigate('/settings')}>
        {blocked ? t('notifBlockedBanner') : t('notifOffBanner')}{' '}
        <strong>{blocked ? t('howToFix') : t('notifEnable')}</strong>
      </button>
      <button className="icon-btn banner-close" onClick={hide} aria-label={t('hide')}>
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}
