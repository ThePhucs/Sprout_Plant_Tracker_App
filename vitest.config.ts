import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts so tests don't start the Cloudflare runtime.
export default defineConfig({ test: { include: ['**/*.test.ts'], exclude: ['node_modules/**'] } });
