// Netlify Function: shareable event pages at /events/<slug> (with link-preview tags) and participant badges at /badge/<token>.
// /events/ itself (the list page) is a normal page built by Eleventy.
import { getStore } from '@netlify/blobs';
import { createHandler } from '../lib/handler.mjs';

const readEnv = (k) => (globalThis.Netlify?.env?.get?.(k)) ?? process.env[k];
const handler = createHandler({
  getStore: (name) => getStore({ name, consistency: 'strong' }),
  env: () => ({ ADMIN_PASSWORD: readEnv('ADMIN_PASSWORD'), SESSION_SECRET: readEnv('SESSION_SECRET'), GSC_SERVICE_ACCOUNT: readEnv('GSC_SERVICE_ACCOUNT'), GSC_SITE_URL: readEnv('GSC_SITE_URL'), ANTHROPIC_API_KEY: readEnv('ANTHROPIC_API_KEY'), ANTHROPIC_MODEL: readEnv('ANTHROPIC_MODEL') }),
});
export default async (req) => handler(req);
export const config = { path: ['/events/:slug', '/badge/:token'] };
