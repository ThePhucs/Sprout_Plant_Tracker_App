// Generates the VAPID key pair that signs push messages.
// Public key -> printed (goes in wrangler.jsonc vars + .env.local). Private key -> .dev.vars only.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const { publicKey, privateKey } = await crypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const pub = b64url(await crypto.subtle.exportKey('raw', publicKey));
const { d } = await crypto.subtle.exportKey('jwk', privateKey);

if (existsSync('.dev.vars') && readFileSync('.dev.vars', 'utf8').includes('VAPID_PRIVATE_KEY=')) {
  console.error('.dev.vars already has a VAPID_PRIVATE_KEY. Delete that line first if you really want new keys.');
  process.exit(1);
}
appendFileSync('.dev.vars', `VAPID_PRIVATE_KEY=${d}\n`);
console.log(`VAPID public key:\n${pub}\nPrivate key written to .dev.vars`);
