import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
  plugins: [react(), cloudflare()],
  // iOS 15 = iPhone 7's last version; it still runs the app (no push there).
  build: { target: ['safari15', 'chrome100'] },
});
