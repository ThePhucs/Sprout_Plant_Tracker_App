import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { isAndroid, isInAppBrowser, isIOS, isStandalone } from './lib/platform';
import { OpenInBrowser } from './screens/OpenInBrowser';
import { InstallAndroid, InstallIOS } from './screens/Install';
import { AuthScreen } from './screens/Auth';
import { Home } from './screens/Home';

const ua = navigator.userAgent;

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [skipInstall, setSkipInstall] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Order matters: each step has to be done before the next one can work.
  if (isInAppBrowser(ua)) return <OpenInBrowser />;
  // iPhone: the Home Screen app has separate storage from Safari, so log in only inside it.
  if (isIOS(ua, navigator.maxTouchPoints) && !isStandalone()) return <InstallIOS />;
  if (isAndroid(ua) && !isStandalone() && !skipInstall) return <InstallAndroid onSkip={() => setSkipInstall(true)} />;
  if (session === undefined) return null; // still reading the saved login
  if (!session) return <AuthScreen />;
  return <Home session={session} />;
}
