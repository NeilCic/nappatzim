import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCAL_SESSIONS_KEY = 'localSessions';

/**
 * @typedef {Object} LocalSessionRoute
 * @property {string} climbId - Climb ID (can be null for unregistered climbs)
 * @property {boolean} isSuccess - Whether the route was sent
 * @property {number} attempts - Number of attempts
 */

/**
 * @typedef {Object} LocalSession
 * @property {string} id - Local temporary ID (e.g., "local_1234567890_abc123")
 * @property {string} startTime - ISO string
 * @property {string|null} endTime - ISO string or null
 * @property {string|null} notes - Session notes or null
 * @property {LocalSessionRoute[]} routes - Array of routes logged in this session
 * @property {'active'|'completed'|'synced'|'sync_failed'} status - Session status
 * @property {string|null} serverSessionId - Server session ID after successful sync (null if not synced)
 */

export function generateLocalSessionId() {
  return `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export async function getLocalSessions() {
  try {
    const data = await AsyncStorage.getItem(LOCAL_SESSIONS_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error('Error getting local sessions:', error);
    return [];
  }
}

export async function saveLocalSession(session) {
  try {
    const sessions = await getLocalSessions();
    const index = sessions.findIndex(s => s.id === session.id);
    
    if (index >= 0) {
      sessions[index] = session;
    } else {
      sessions.push(session);
    }
    
    await AsyncStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error('Error saving local session:', error);
    throw error;
  }
}

export async function getLocalSession(sessionId) {
  try {
    const sessions = await getLocalSessions();
    return sessions.find(s => s.id === sessionId) || null;
  } catch (error) {
    console.error('Error getting local session:', error);
    return null;
  }
}

export async function getActiveLocalSession() {
  try {
    const sessions = await getLocalSessions();
    return sessions.find(s => s.status === 'active') || null;
  } catch (error) {
    console.error('Error getting active local session:', error);
    return null;
  }
}

export async function updateLocalSession(sessionId, updates) {
  try {
    const sessions = await getLocalSessions();
    const index = sessions.findIndex(s => s.id === sessionId);
    
    if (index < 0) return null;
    
    sessions[index] = { ...sessions[index], ...updates };
    await AsyncStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(sessions));
    
    return sessions[index];
  } catch (error) {
    console.error('Error updating local session:', error);
    throw error;
  }
}

export async function batchUpdateLocalSessions(updates) {
  if (updates.size === 0) return;
  
  try {
    const sessions = await getLocalSessions();
    let hasChanges = false;
    
    for (let i = 0; i < sessions.length; i++) {
      const update = updates.get(sessions[i].id);
      if (update) {
        sessions[i] = { ...sessions[i], ...update };
        hasChanges = true;
      }
    }
    
    if (hasChanges) {
      await AsyncStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(sessions));
    }
  } catch (error) {
    console.error('Error batch updating local sessions:', error);
    throw error;
  }
}

export async function deleteLocalSession(sessionId) {
  try {
    const sessions = await getLocalSessions();
    const index = sessions.findIndex(s => s.id === sessionId);
    
    if (index >= 0) {
      sessions.splice(index, 1);
      await AsyncStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(sessions));
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting local session:', error);
    return false;
  }
}

export async function getPendingSyncSessions() {
  try {
    const sessions = await getLocalSessions();
    return sessions.filter(s => s.status === 'completed' || s.status === 'sync_failed');
  } catch (error) {
    console.error('Error getting pending sync sessions:', error);
    return [];
  }
}
