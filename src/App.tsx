import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { isAndroid, isInAppBrowser, isIOS, isStandalone } from './lib/platform';
import { OpenInBrowser } from './screens/OpenInBrowser';
import { InstallAndroid, InstallIOS } from './screens/Install';
import { AuthScreen } from './screens/Auth';
import { Main } from './screens/Main';

const ua = navigator.userAgent;

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  // Remember "continue in the browser" so Android users aren't asked on every visit.
  const [skipInstall, setSkipInstall] = useState(() => {
    try { return localStorage.getItem('skipInstall') === '1'; } catch { return false; }
  });
  const skip = () => {
    try { localStorage.setItem('skipInstall', '1'); } catch { /* storage blocked */ }
    setSkipInstall(true);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Order matters: each step has to be done before the next one can work.
  if (isInAppBrowser(ua)) return <OpenInBrowser />;
  // iPhone: the Home Screen app has separate storage from Safari, so log in only inside it.
  if (isIOS(ua, navigator.maxTouchPoints) && !isStandalone()) return <InstallIOS />;
  if (isAndroid(ua) && !isStandalone() && !skipInstall) return <InstallAndroid onSkip={skip} />;
  if (session === undefined) return null; // still reading the saved login
  if (!session) return <AuthScreen />;
  return <Main session={session} />;
}
