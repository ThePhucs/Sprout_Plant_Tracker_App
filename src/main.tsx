import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { LangProvider } from './i18n';
import { registerServiceWorker } from './lib/push';
import { pushApiAvailable } from './lib/platform';
import { watchSystemTheme } from './lib/theme';
import './styles.css';

if (pushApiAvailable()) registerServiceWorker().catch(console.error);
watchSystemTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LangProvider>
      <App />
    </LangProvider>
  </StrictMode>,
);
