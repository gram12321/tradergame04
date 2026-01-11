import { createClient } from '@supabase/supabase-js'

// Safe environment variable retrieval for both Vite (browser) and Node.js
const getEnv = (name: string): string => {
  // Deno way
  if (typeof Deno !== 'undefined') {
    return Deno.env.get(name) || Deno.env.get(name.replace('VITE_', '')) || '';
  }

  // Vite/Browser way
  const viteEnv = (import.meta as any).env?.[name];
  if (viteEnv) return viteEnv;

  // Node.js way (using globalThis to avoid "process is not defined" errors in browser)
  const nodeEnv = (globalThis as any).process?.env?.[name];
  if (nodeEnv) return nodeEnv;

  return '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials missing. Database functionality will not work.');
}

// Fallback values prevent the client from throwing during initialization in non-DB tests
export const supabase = createClient(
  supabaseUrl || 'https://missing-url.supabase.co',
  supabaseAnonKey || 'missing-key'
);
