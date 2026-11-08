import { useEffect, useState, type FormEvent } from 'react';
import type { AuthError } from '@supabase/supabase-js';
import { LangToggle, useLang } from '../i18n';
import { supabase } from '../lib/supabase';
import { isValidUsername, normalizeUsername, usernameToEmail } from '../../shared/username';
import { ADMIN_MESSENGER } from '../config';
import { Icon } from '../components/Icon';
import type { StringKey } from '../../shared/i18n';

export function AuthScreen() {
  const { t, lang } = useLang();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<StringKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(false);

  useEffect(() => {
    if (mode === 'signup') supabase.rpc('signup_open').then(({ data }) => setFull(data === false));
  }, [mode]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const u = normalizeUsername(username);
    if (!isValidUsername(u)) return setError('errUsername');
    if (password.length < 8) return setError('errPassword');
    setBusy(true);
    setError(null);
    const email = usernameToEmail(u);
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(loginError(error));
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName.trim() || null,
            language: lang,
            time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        },
      });
      if (error) setError(await signupError(error));
      else if (!data.session) setError('errConfirmOn');
    }
    setBusy(false);
  };

  return (
    <main className="screen">
      <LangToggle />
      <img src="/icons/icon-192.png" alt="" className="logo" />
      <h1>Sprout</h1>
      <p className="muted">{t('tagline')}</p>

      <form className="card form" onSubmit={submit} noValidate>
        <h2>{mode === 'login' ? t('login') : t('signup')}</h2>
        {mode === 'signup' && full && <p className="warn">{t('errFull')}</p>}
        <label>
          {t('username')}
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username"
            autoCapitalize="none" autoCorrect="off" spellCheck={false} required />
          {mode === 'signup' && <small>{t('usernameHint')}</small>}
        </label>
        <label>
          {t('password')}
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} />
          {mode === 'signup' && <small>{t('passwordHint')}</small>}
        </label>
        {mode === 'signup' && (
          <label>
            {t('displayName')}
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} autoComplete="nickname" />
            <small>{t('displayNameHint')}</small>
          </label>
        )}
        {error && <p className="error" role="alert">{t(error)}</p>}
        <button className="button" disabled={busy || (mode === 'signup' && full)}>
          {mode === 'login' ? t('login') : t('signup')}
        </button>
      </form>

      <button className="link" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}>
        {mode === 'login' ? t('noAccount') : t('haveAccount')}
      </button>
      {mode === 'login' && (
        <p className="muted center">
          {t('forgot')} <a href={ADMIN_MESSENGER} target="_blank" rel="noreferrer" className="with-icon"><Icon name="message" size={18} />{t('messageAdmin')}</a>
        </p>
      )}
    </main>
  );
}

const isNetwork = (e: AuthError) => e.name === 'AuthRetryableFetchError' || e.status === 0;

function loginError(e: AuthError): StringKey {
  if (isNetwork(e)) return 'errNetwork';
  return e.code === 'invalid_credentials' ? 'errLogin' : 'errGeneric';
}

async function signupError(e: AuthError): Promise<StringKey> {
  if (isNetwork(e)) return 'errNetwork';
  if (e.code === 'user_already_exists' || e.code === 'email_exists') return 'errTaken';
  if (e.code === 'weak_password') return 'errPassword';
  // The database refuses sign-ups past the account cap; Supabase hides the reason, so ask again.
  const { data } = await supabase.rpc('signup_open');
  return data === false ? 'errFull' : 'errGeneric';
}
