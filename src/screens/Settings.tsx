import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useLang } from '../i18n';
import { supabase, type Profile } from '../lib/supabase';
import { enablePush, forgetThisDevice, sendTestPush, syncPushSubscription, type TestResult } from '../lib/push';
import { iosSupportsPush, isAndroid, isIOS, pushApiAvailable } from '../lib/platform';
import type { Lang, StringKey } from '../../shared/i18n';
import { ADMIN_MESSENGER } from '../config';
import { Icon } from '../components/Icon';
import { PhotoLimitNote } from '../components/Photo';
import { photoUsage, type PhotoUsage } from '../lib/photos';
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme';
import { usernameToEmail } from '../../shared/username';
import { useConfirm } from '../components/Confirm';

/** Asks for the current password first, so someone holding an unlocked phone can't change it. */
function ChangePassword({ username }: { username: string }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<StringKey | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <>
        {done && <p className="ok">{t('passwordChanged')}</p>}
        <button className="button secondary" onClick={() => { setOpen(true); setDone(false); }}>{t('changePassword')}</button>
      </>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return setError('errPassword');
    if (next !== repeat) return setError('errMismatch');
    if (next === current) return setError('errSame');
    setBusy(true);
    setError(null);
    const check = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password: current });
    if (check.error) {
      setBusy(false);
      return setError(check.error.code === 'invalid_credentials' ? 'errCurrent' : 'errNetwork');
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: next });
    setBusy(false);
    if (updateError) return setError(updateError.code === 'same_password' ? 'errSame' : 'errGeneric');
    setCurrent(''); setNext(''); setRepeat('');
    setOpen(false);
    setDone(true);
  };

  return (
    <form className="form card inner" onSubmit={submit} noValidate>
      <h3>{t('changePassword')}</h3>
      {/* Hidden username helps iPhone/Chrome offer to update the saved password. */}
      <input type="text" autoComplete="username" value={username} readOnly hidden />
      <label>
        {t('currentPassword')}
        <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </label>
      <label>
        {t('newPassword')}
        <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        <small>{t('passwordHint')}</small>
      </label>
      <label>
        {t('repeatPassword')}
        <input type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
      </label>
      {error && <p className="error" role="alert">{t(error)}</p>}
      <div className="row">
        <button type="button" className="button secondary" onClick={() => { setOpen(false); setError(null); }}>{t('cancel')}</button>
        <button className="button" disabled={busy}>{t('save')}</button>
      </div>
    </form>
  );
}

export type SaveProfile = (patch: Partial<Pick<Profile, 'display_name' | 'language' | 'time_zone' | 'reminder_hour'>>) => Promise<boolean>;

/** Empty clears it: the app then greets them by username. */
function DisplayName({ current, saveProfile }: { current: string | null; saveProfile: SaveProfile }) {
  const { t } = useLang();
  const [name, setName] = useState(current ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const clean = name.trim() || null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('saving');
    setStatus((await saveProfile({ display_name: clean })) ? 'saved' : 'error');
  };

  return (
    <form className="form" onSubmit={save}>
      <label>
        {t('displayName')}
        <input value={name} maxLength={40} autoComplete="nickname"
          onChange={(e) => { setName(e.target.value); setStatus('idle'); }} />
        <small>{t('displayNameHint')}</small>
      </label>
      {status === 'saved' && <p className="ok">{t('saved')}</p>}
      {status === 'error' && <p className="error" role="alert">{t('errSave')}</p>}
      {clean !== current && <button className="button" disabled={status === 'saving'}>{t('save')}</button>}
    </form>
  );
}

export function Settings({ session, profile, saveProfile }: { session: Session; profile: Profile; saveProfile: SaveProfile }) {
  const { t, lang, setLang } = useLang();
  const [savedNote, setSavedNote] = useState(false);
  const [usage, setUsage] = useState<PhotoUsage | null>(null);
  const [theme, setTheme] = useState<ThemePref>(getThemePref);
  useEffect(() => { photoUsage().then(setUsage); }, []);

  const changeLang = async (l: Lang) => {
    setLang(l);
    await saveProfile({ language: l });
  };

  const changeHour = async (h: number) => {
    if (await saveProfile({ reminder_hour: h })) {
      setSavedNote(true);
      setTimeout(() => setSavedNote(false), 2000);
    }
  };

  const confirm = useConfirm();
  const logout = async () => {
    if (!(await confirm(t('confirmLogout'), t('logout')))) return;
    await forgetThisDevice().catch(console.error);
    await supabase.auth.signOut();
  };

  return (
    <>
      <h1>{t('tabSettings')}</h1>

      <Notifications accessToken={session.access_token} />

      <section className="card form">
        <label>
          {t('reminderTime')}
          <select value={profile.reminder_hour} onChange={(e) => changeHour(Number(e.target.value))}>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
            ))}
          </select>
          {savedNote && <small className="ok">{t('saved')}</small>}
        </label>
        <label>
          {t('language')}
          <select value={lang} onChange={(e) => changeLang(e.target.value as Lang)}>
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </label>
        <label>
          {t('theme')}
          <select value={theme} onChange={(e) => { const v = e.target.value as ThemePref; setTheme(v); setThemePref(v); }}>
            <option value="system">{t('themeSystem')}</option>
            <option value="light">{t('themeLight')}</option>
            <option value="dark">{t('themeDark')}</option>
          </select>
        </label>
        <small className="muted">{t('timezoneLabel', { tz: profile.time_zone })}</small>
      </section>

      <section className="card">
        <h2>{t('account')}</h2>
        <p>{t('signedInAs', { username: profile.username })}</p>
        <DisplayName current={profile.display_name} saveProfile={saveProfile} />
        {usage && <p>{t('photoUsage', { used: String(usage.used), limit: String(usage.limit) })}</p>}
        {usage && <PhotoLimitNote usage={usage} />}
        {profile.verified ? (
          <p className="ok">{t('verified')}</p>
        ) : (
          <p className="muted">
            {t('notVerified')} <a href={ADMIN_MESSENGER} target="_blank" rel="noreferrer" className="with-icon"><Icon name="message" size={18} />{t('messageAdmin')}</a>
          </p>
        )}
        <ChangePassword username={profile.username} />
        <button className="link danger" onClick={logout}>{t('logout')}</button>
      </section>
    </>
  );
}

type Stage = 'idle' | 'sending' | 'sent' | 'ok' | 'trouble';
const BRANDS: [string, StringKey][] = [
  ['Xiaomi / Redmi / POCO', 'brandXiaomi'],
  ['OPPO / Realme', 'brandOppo'],
  ['vivo', 'brandVivo'],
  ['Samsung', 'brandSamsung'],
  ['iPhone', 'brandIPhone'],
  ['Khác / Other', 'brandOther'],
];

function Notifications({ accessToken }: { accessToken: string }) {
  const { t } = useLang();
  const ua = navigator.userAgent;
  const ios = isIOS(ua, navigator.maxTouchPoints);
  const available = pushApiAvailable();
  const [permission, setPermission] = useState<NotificationPermission>(available ? Notification.permission : 'denied');
  const [stage, setStage] = useState<Stage>('idle');
  const [testMsg, setTestMsg] = useState<StringKey | null>(null);
  const [brand, setBrand] = useState<StringKey | null>(null);

  // Notice when the user allows/blocks notifications in browser settings, without a reload.
  useEffect(() => {
    let status: PermissionStatus | undefined;
    const update = () => setPermission(Notification.permission);
    navigator.permissions?.query({ name: 'notifications' }).then((s) => { status = s; s.onchange = update; }).catch(() => {});
    window.addEventListener('focus', update);
    return () => { if (status) status.onchange = null; window.removeEventListener('focus', update); };
  }, []);

  // Self-healing: re-save this device's subscription every time the app opens.
  useEffect(() => {
    if (available && permission === 'granted') syncPushSubscription().catch(console.error);
  }, [available, permission]);

  if (ios && !iosSupportsPush(ua)) return <Card><p className="warn">{t('notifOldIOS')}</p></Card>;
  if (!available) return <Card><p className="warn">{t('notifUnsupported')}</p></Card>;

  if (permission === 'default') {
    return (
      <Card>
        <p>{t('notifExplain')}</p>
        <button className="button" onClick={async () => setPermission(await enablePush())}>{t('notifEnable')}</button>
      </Card>
    );
  }
  if (permission === 'denied') {
    return (
      <Card>
        <p className="warn">{t('notifDenied')}</p>
        <ol className="steps small">
          {(ios ? t('notifDeniedIOS') : isAndroid(ua) ? t('notifDeniedAndroid') : t('notifDeniedDesktop')).split('|').map((step) => <li key={step}>{step}</li>)}
        </ol>
      </Card>
    );
  }

  const test = async () => {
    setStage('sending');
    setTestMsg(null);
    const result: TestResult = await sendTestPush(accessToken);
    if (result === 'sent') setStage('sent');
    else {
      setStage('idle');
      setTestMsg(result === 'wait' ? 'testWait' : 'testFailed');
    }
  };

  return (
    <Card>
      <p className="ok">{t('notifOn')}</p>
      {stage === 'ok' && <p className="ok">{t('testOk')}</p>}
      {stage === 'sent' ? (
        <>
          <p>{t('testSent')}</p>
          <div className="row">
            <button className="button" onClick={() => setStage('ok')}>{t('testGot')}</button>
            <button className="button secondary" onClick={() => setStage('trouble')}>{t('testNotGot')}</button>
          </div>
        </>
      ) : (
        <button className="button secondary" onClick={test} disabled={stage === 'sending'}>
          {stage === 'sending' ? t('testSending') : t('testSend')}
        </button>
      )}
      {testMsg && <p className="error">{t(testMsg)}</p>}
      {stage === 'trouble' && (
        <div className="trouble">
          <h3>{t('troubleTitle')}</h3>
          <p>{t('troublePick')}</p>
          <div className="chips">
            {BRANDS.map(([name, key]) => (
              <button key={key} className={`chip ${brand === key ? 'active' : ''}`} onClick={() => setBrand(key)}>{name}</button>
            ))}
          </div>
          {brand && <p className="card inner">{t(brand)}</p>}
          <button className="button" onClick={test}>{t('troubleRetry')}</button>
        </div>
      )}
    </Card>
  );
}

function Card({ children }: { children: ReactNode }) {
  const { t } = useLang();
  return (
    <section className="card">
      <h2>{t('notifTitle')}</h2>
      {children}
    </section>
  );
}
