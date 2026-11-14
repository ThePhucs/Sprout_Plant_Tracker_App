import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useLang } from '../i18n';
import { supabase, type Profile } from '../lib/supabase';
import { PlantsProvider } from '../lib/plants';
import { navigate, usePath } from '../lib/router';
import { ToastProvider } from '../components/Toast';
import { ConfirmProvider } from '../components/Confirm';
import { Icon } from '../components/Icon';
import { Today } from './Today';
import { Plants } from './Plants';
import { PlantDetail } from './PlantDetail';
import { PlantEdit } from './PlantEdit';
import { Settings, type SaveProfile } from './Settings';
import { Garden } from './Garden';
import { PhotoPost } from './PhotoPost';
import { MeContext } from '../lib/me';

export function Main({ session }: { session: Session }) {
  const { setLang } = useLang();
  const [profile, setProfile] = useState<Profile | null>(null);
  const path = usePath();

  const saveProfile: SaveProfile = async (patch) => {
    const { data } = await supabase.from('profiles').update(patch).eq('id', session.user.id).select().single<Profile>();
    if (data) setProfile(data);
    return !!data;
  };

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

  if (!profile) return <main className="screen"><p className="muted center">…</p></main>;

  const plantMatch = /^\/plants\/(\d+)(\/edit)?$/.exec(path);
  let screen;
  if (path === '/plants') screen = <Plants />;
  else if (path === '/plants/new') screen = <PlantEdit key="new" />;
  else if (plantMatch) screen = plantMatch[2] ? <PlantEdit key={path} id={Number(plantMatch[1])} /> : <PlantDetail key={path} id={Number(plantMatch[1])} />;
  else if (path === '/garden') screen = <Garden />;
  else if (/^\/photos\/\d+$/.test(path)) screen = <PhotoPost key={path} id={Number(path.split('/')[2])} />;
  else if (path === '/settings') screen = <Settings session={session} profile={profile} saveProfile={saveProfile} />;
  else screen = <Today name={profile.display_name || profile.username} />;

  const tab = path.startsWith('/plants') ? 'plants' : path === '/garden' || path.startsWith('/photos') ? 'garden' : path === '/settings' ? 'settings' : 'today';

  return (
    <MeContext.Provider value={{ id: session.user.id, verified: profile.verified }}>
    <ToastProvider>
      <ConfirmProvider>
        <PlantsProvider userId={session.user.id}>
          <main className="screen with-tabs">{screen}</main>
          <TabBar current={tab} />
        </PlantsProvider>
      </ConfirmProvider>
    </ToastProvider>
    </MeContext.Provider>
  );
}

function TabBar({ current }: { current: string }) {
  const { t } = useLang();
  const tabs = [
    ['today', '/today', 'calendar', t('tabToday')],
    ['plants', '/plants', 'sprout', t('tabPlants')],
    ['garden', '/garden', 'garden', t('tabGarden')],
    ['settings', '/settings', 'settings', t('tabSettings')],
  ] as const;
  return (
    <nav className="tabbar">
      {tabs.map(([key, href, icon, label]) => (
        <a key={key} href={href} aria-current={current === key ? 'page' : undefined}
          onClick={(e) => { e.preventDefault(); navigate(href); }}>
          <Icon name={icon} size={24} />
          {label}
        </a>
      ))}
    </nav>
  );
}
