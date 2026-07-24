import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabaseInstance = null;

function getSupabaseClient() {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }

  try {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabaseInstance;
  } catch (initializationError) {
    console.error('Supabase initialization failed:', initializationError);
    return null;
  }
}

async function purgeRemoteSession(username) {
  const client = getSupabaseClient();
  if (!client || !username) {
    return { success: true };
  }

  try {
    if (username.startsWith('SES-')) {
      await client.from('audit_sessions').delete().eq('session_id', username);
    } else {
      await client.from('unfollow_targets').delete().eq('ig_username', username);
      await client.from('unfollow_logs').delete().eq('target_username', username);
    }
    return { success: true };
  } catch (networkError) {
    console.error('Remote purge exception:', networkError);
    return { success: true };
  }
}

export {
  getSupabaseClient,
  purgeRemoteSession,
};
