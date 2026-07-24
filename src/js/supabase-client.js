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
    return null;
  }
}

function generateRandomSegment(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let index = 0; index < length; index++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function generateSessionCredentials() {
  const sessionId = `SES-${generateRandomSegment(6)}`;
  const securityKey = `IC-KEY-${generateRandomSegment(4)}-${generateRandomSegment(4)}`;
  return { sessionId, securityKey };
}

function getActiveSessionCredentials() {
  try {
    const sessionId = localStorage.getItem('instaclear_session_id');
    const securityKey = localStorage.getItem('instaclear_security_key');
    const alias = localStorage.getItem('instaclear_session_alias') || '';

    if (!sessionId || !securityKey) {
      return null;
    }

    return { sessionId, securityKey, alias };
  } catch (storageError) {
    return null;
  }
}

function saveActiveSessionCredentials(sessionId, securityKey, alias = '') {
  try {
    localStorage.setItem('instaclear_session_id', sessionId);
    localStorage.setItem('instaclear_security_key', securityKey);
    localStorage.setItem('instaclear_session_alias', alias);
  } catch (storageError) {
    return false;
  }
}

function clearActiveSessionCredentials() {
  try {
    localStorage.removeItem('instaclear_session_id');
    localStorage.removeItem('instaclear_security_key');
    localStorage.removeItem('instaclear_session_alias');
  } catch (storageError) {
    return false;
  }
}

async function createNewSession(alias = '', totalTargets = 0) {
  const credentials = generateSessionCredentials();
  const client = getSupabaseClient();
  const sessionAlias = alias.trim() || credentials.sessionId;

  saveActiveSessionCredentials(
    credentials.sessionId,
    credentials.securityKey,
    sessionAlias
  );

  if (!client) {
    return {
      sessionId: credentials.sessionId,
      securityKey: credentials.securityKey,
      alias: sessionAlias,
    };
  }

  try {
    await client.from('audit_sessions').insert({
      session_id: credentials.sessionId,
      session_alias: sessionAlias,
      security_key_hash: credentials.securityKey,
      total_targets: totalTargets,
      created_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
    });
  } catch (networkError) {
    return {
      sessionId: credentials.sessionId,
      securityKey: credentials.securityKey,
      alias: sessionAlias,
    };
  }

  return {
    sessionId: credentials.sessionId,
    securityKey: credentials.securityKey,
    alias: sessionAlias,
  };
}

async function restoreSession(sessionId, securityKey) {
  const client = getSupabaseClient();

  if (!client) {
    const active = getActiveSessionCredentials();
    if (
      active &&
      active.sessionId === sessionId &&
      active.securityKey === securityKey
    ) {
      return { success: true, alias: active.alias, unfollowedUsernames: [] };
    }
    return {
      success: false,
      error: 'Tidak dapat terhubung ke server Supabase untuk verifikasi kunci.',
    };
  }

  try {
    const { data, error } = await client
      .from('audit_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('security_key_hash', securityKey)
      .single();

    if (error || !data) {
      return {
        success: false,
        error: 'Session ID atau Kunci Akses tidak cocok atau tidak ditemukan.',
      };
    }

    await client
      .from('audit_sessions')
      .update({ last_active_at: new Date().toISOString() })
      .eq('session_id', sessionId);

    saveActiveSessionCredentials(sessionId, securityKey, data.session_alias);

    const unfollowedHistory = await fetchSessionProgress(sessionId);

    return {
      success: true,
      alias: data.session_alias,
      sessionId: data.session_id,
      securityKey: securityKey,
      unfollowedUsernames: unfollowedHistory,
    };
  } catch (networkError) {
    return {
      success: false,
      error: 'Terjadi kesalahan jaringan saat memulihkan sesi.',
    };
  }
}

async function fetchSessionProgress(sessionId) {
  const client = getSupabaseClient();

  if (!client || !sessionId) {
    return [];
  }

  try {
    const { data, error } = await client
      .from('unfollow_targets')
      .select('ig_username')
      .eq('session_id', sessionId)
      .eq('action_status', 'UNFOLLOWED');

    if (error || !data) {
      return [];
    }

    return data.map((record) => record.ig_username);
  } catch (networkError) {
    return [];
  }
}

async function updateTargetStatusInSession(sessionId, username, status) {
  const client = getSupabaseClient();

  if (!client || !sessionId) {
    return { success: false };
  }

  try {
    const { error } = await client.from('unfollow_targets').upsert(
      {
        session_id: sessionId,
        ig_username: username,
        action_status: status,
        executed_at: new Date().toISOString(),
      },
      { onConflict: 'session_id,ig_username' }
    );

    if (error) {
      return { success: false };
    }

    return { success: true };
  } catch (networkError) {
    return { success: false };
  }
}

export {
  generateSessionCredentials,
  getActiveSessionCredentials,
  saveActiveSessionCredentials,
  clearActiveSessionCredentials,
  createNewSession,
  restoreSession,
  fetchSessionProgress,
  updateTargetStatusInSession,
};
