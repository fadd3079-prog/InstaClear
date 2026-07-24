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

function getDeviceUUID() {
  const STORAGE_KEY = 'instaclear_device_id';
  const existingDeviceId = localStorage.getItem(STORAGE_KEY);

  if (existingDeviceId) {
    return existingDeviceId;
  }

  const newDeviceId = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, newDeviceId);
  return newDeviceId;
}

async function fetchUnfollowedHistory(deviceId) {
  const client = getSupabaseClient();

  if (!client) {
    return [];
  }

  try {
    const { data, error } = await client
      .from('unfollow_logs')
      .select('target_username')
      .eq('device_id', deviceId)
      .eq('status', 'UNFOLLOWED');

    if (error) {
      return [];
    }

    return data || [];
  } catch (networkError) {
    return [];
  }
}

async function markAsUnfollowed(deviceId, username) {
  const client = getSupabaseClient();

  if (!client) {
    return { success: false };
  }

  try {
    const { error } = await client.from('unfollow_logs').upsert(
      {
        device_id: deviceId,
        target_username: username,
        status: 'UNFOLLOWED',
        executed_at: new Date().toISOString(),
      },
      { onConflict: 'device_id,target_username' }
    );

    if (error) {
      return { success: false };
    }

    return { success: true };
  } catch (networkError) {
    return { success: false };
  }
}

export { getDeviceUUID, fetchUnfollowedHistory, markAsUnfollowed };
