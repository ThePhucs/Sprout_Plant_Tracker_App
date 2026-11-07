import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useLang } from '../i18n';
import { supabase, type Profile } from '../lib/supabase';
import { enablePush, forgetThisDevice, sendTestPush, syncPushSubscription, type TestResult } from '../lib/push';
import { iosSupportsPush, isAndroid, isIOS, pushApiAvailable } from '../lib/platform';
import type { Lang, StringKey } from '../../shared/i18n';

// Prototype home: proves accounts + reminders work before plants are built.
export function Home({ session }: { session: Session }) {
  const { t, lang, setLang } = useLang();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [savedNote, setSavedNote] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single<Profile>();
      if (!data) return;
      setProfile(data);
      setLang(data.language); // the account's language wins on a new device
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && tz !== data.time_zone) await saveProfile({ time_zone: tz }); // e.g. moved country
    })();
  }, [session.user.id]);

  async function saveProfile(patch: Partial<Pick<Profile, 'language' | 'time_zone' | 'reminder_hour'>>) {
    const { data } = await supabase.from('profiles').update(patch).eq('id', session.user.id).select().single<Profile>();
    if (data) setProfile(data);
    return !!data;
  }

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

  const logout = async () => {
    await forgetThisDevice().catch(console.error);
    await supabase.auth.signOut();
  };

  if (!profile) return <main className="screen"><p className="muted center">…</p></main>;

  return (
    <main className="screen">
      <h1>{t('hello', { name: profile.display_name || profile.username })}</h1>

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
        <small className="muted">{profile.time_zone}</small>
      </section>

      <button className="link" onClick={logout}>{t('logout')}</button>
    </main>
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
        <p>{ios ? t('notifDeniedIOS') : isAndroid(ua) ? t('notifDeniedAndroid') : t('notifDeniedDesktop')}</p>
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
