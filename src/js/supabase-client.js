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
    console.error('Failed to read localStorage credentials:', storageError);
    return null;
  }
}

function saveActiveSessionCredentials(sessionId, securityKey, alias = '') {
  try {
    localStorage.setItem('instaclear_session_id', sessionId.trim().toUpperCase());
    localStorage.setItem('instaclear_security_key', securityKey.trim().toUpperCase());
    localStorage.setItem('instaclear_session_alias', alias.trim());
    return true;
  } catch (storageError) {
    console.error('Failed to save localStorage credentials:', storageError);
    return false;
  }
}

function clearActiveSessionCredentials() {
  try {
    localStorage.removeItem('instaclear_session_id');
    localStorage.removeItem('instaclear_security_key');
    localStorage.removeItem('instaclear_session_alias');
    return true;
  } catch (storageError) {
    console.error('Failed to clear localStorage credentials:', storageError);
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
    const { error } = await client.from('audit_sessions').insert({
      session_id: credentials.sessionId,
      session_alias: sessionAlias,
      security_key_hash: credentials.securityKey,
      total_targets: totalTargets,
      created_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Supabase insert audit_sessions error:', error);
    }
  } catch (networkError) {
    console.error('Network exception during session creation:', networkError);
  }

  return {
    sessionId: credentials.sessionId,
    securityKey: credentials.securityKey,
    alias: sessionAlias,
  };
}

async function restoreSession(sessionId, securityKey) {
  const cleanSessionId = (sessionId || '').trim().toUpperCase();
  const cleanSecurityKey = (securityKey || '').trim().toUpperCase();

  if (!cleanSessionId || !cleanSecurityKey) {
    return {
      success: false,
      error: 'Mohon isi Session ID dan Kunci Akses secara lengkap.',
    };
  }

  const client = getSupabaseClient();

  if (!client) {
    const active = getActiveSessionCredentials();
    if (
      active &&
      active.sessionId === cleanSessionId &&
      active.securityKey === cleanSecurityKey
    ) {
      return {
        success: true,
        alias: active.alias,
        sessionId: active.sessionId,
        securityKey: active.securityKey,
        allTargets: [],
        unfollowedUsernames: [],
      };
    }
    return {
      success: false,
      error: 'Tidak dapat terhubung ke server database.',
    };
  }

  try {
    const { data, error } = await client
      .from('audit_sessions')
      .select('*')
      .eq('session_id', cleanSessionId)
      .eq('security_key_hash', cleanSecurityKey)
      .maybeSingle();

    if (error) {
      console.error('Supabase restoreSession query error:', error);
      return {
        success: false,
        error: 'Gagal memverifikasi data sesi dari peladen.',
      };
    }

    if (!data) {
      return {
        success: false,
        error: 'Sesi tidak ditemukan atau Kunci Akses salah. Periksa kembali kombinasi yang Anda masukkan.',
      };
    }

    await client
      .from('audit_sessions')
      .update({ last_active_at: new Date().toISOString() })
      .eq('session_id', cleanSessionId);

    saveActiveSessionCredentials(
      cleanSessionId,
      cleanSecurityKey,
      data.session_alias
    );

    const sessionData = await fetchSessionTargetsAndProgress(cleanSessionId);

    return {
      success: true,
      alias: data.session_alias || cleanSessionId,
      sessionId: cleanSessionId,
      securityKey: cleanSecurityKey,
      allTargets: sessionData.allTargets,
      unfollowedUsernames: sessionData.unfollowedUsernames,
    };
  } catch (networkError) {
    console.error('Network error during restoreSession:', networkError);
    return {
      success: false,
      error: 'Terjadi kesalahan jaringan saat memulihkan sesi.',
    };
  }
}

async function fetchSessionTargetsAndProgress(sessionId) {
  const client = getSupabaseClient();

  if (!client || !sessionId) {
    return { allTargets: [], unfollowedUsernames: [] };
  }

  try {
    const { data, error } = await client
      .from('unfollow_targets')
      .select('ig_username, action_status')
      .eq('session_id', sessionId);

    if (error || !data) {
      console.error('Fetch session targets error:', error);
      return { allTargets: [], unfollowedUsernames: [] };
    }

    const allTargets = data.map((record) => record.ig_username);
    const unfollowedUsernames = data
      .filter((record) => record.action_status === 'UNFOLLOWED')
      .map((record) => record.ig_username);

    return { allTargets, unfollowedUsernames };
  } catch (networkError) {
    console.error('Network exception in fetchSessionTargetsAndProgress:', networkError);
    return { allTargets: [], unfollowedUsernames: [] };
  }
}

async function insertUnfollowTargets(sessionId, targetUsernames) {
  const client = getSupabaseClient();

  if (!client || !sessionId || !targetUsernames || targetUsernames.length === 0) {
    return { success: false };
  }

  try {
    const targetRows = targetUsernames.map((username) => ({
      session_id: sessionId,
      ig_username: username,
      source_category: 'NOT_FOLLOWING_BACK',
      action_status: 'WAITING',
    }));

    const { error } = await client
      .from('unfollow_targets')
      .upsert(targetRows, { onConflict: 'session_id,ig_username', ignoreDuplicates: true });

    if (error) {
      console.error('Error inserting unfollow targets:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (err) {
    console.error('Exception inserting unfollow targets:', err);
    return { success: false, error: err };
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
      console.error('Error updating target status in session:', error);
      return { success: false };
    }

    return { success: true };
  } catch (networkError) {
    console.error('Exception updating target status:', networkError);
    return { success: false };
  }
}

async function deletePermanentSession(sessionId, securityKey) {
  const client = getSupabaseClient();

  clearActiveSessionCredentials();

  if (!client || !sessionId || !securityKey) {
    return { success: true };
  }

  try {
    const { data, error: verifyError } = await client
      .from('audit_sessions')
      .select('session_id')
      .eq('session_id', sessionId)
      .eq('security_key_hash', securityKey)
      .maybeSingle();

    if (verifyError || !data) {
      console.error('Verify error during permanent deletion:', verifyError);
      return {
        success: false,
        error: 'Verifikasi Kunci Akses gagal. Sesi tidak dapat dihapus.',
      };
    }

    const { error: deleteError } = await client
      .from('audit_sessions')
      .delete()
      .eq('session_id', sessionId);

    if (deleteError) {
      console.error('Delete audit_sessions error:', deleteError);
      return {
        success: false,
        error: 'Gagal menghapus sesi dari peladen database.',
      };
    }

    return { success: true };
  } catch (networkError) {
    console.error('Exception during permanent session deletion:', networkError);
    return { success: true };
  }
}

export {
  generateSessionCredentials,
  getActiveSessionCredentials,
  saveActiveSessionCredentials,
  clearActiveSessionCredentials,
  createNewSession,
  restoreSession,
  fetchSessionTargetsAndProgress,
  insertUnfollowTargets,
  updateTargetStatusInSession,
  deletePermanentSession,
};
