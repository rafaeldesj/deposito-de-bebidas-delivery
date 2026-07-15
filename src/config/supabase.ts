import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseUrl = (rawUrl && rawUrl.startsWith('http')) ? rawUrl : 'https://your-supabase-url.supabase.co';

const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseAnonKey = (rawKey && !rawKey.startsWith('INSERIR')) ? rawKey : 'your-supabase-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
