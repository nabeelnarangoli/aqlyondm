// Netlify Function: every request to /api/* lands here (event module).
import { getStore } from '@netlify/blobs';
import { createHandler } from '../lib/handler.mjs';

const readEnv = (k) => (globalThis.Netlify?.env?.get?.(k)) ?? process.env[k];
const handler = createHandler({
  getStore: (name) => getStore({ name, consistency: 'strong' }),
  env: () => ({ ADMIN_PASSWORD: readEnv('ADMIN_PASSWORD'), SESSION_SECRET: readEnv('SESSION_SECRET'), GSC_SERVICE_ACCOUNT: readEnv('GSC_SERVICE_ACCOUNT'), GSC_SITE_URL: readEnv('GSC_SITE_URL'), ANTHROPIC_API_KEY: readEnv('ANTHROPIC_API_KEY'), ANTHROPIC_MODEL: readEnv('ANTHROPIC_MODEL') }),
});
export default async (req) => handler(req);
export const config = { path: '/api/*' };
