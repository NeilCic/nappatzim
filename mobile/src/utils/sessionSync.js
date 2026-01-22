import { getPendingSyncSessions, batchUpdateLocalSessions, updateLocalSession, getLocalSession, deleteLocalSession } from './localSessionStorage';
import { showErrorAlert } from './alert';

export async function syncLocalSessions(api, options = {}) {
  const { showErrors = true, onProgress, sessions: providedSessions } = options;

  const pendingSessions = providedSessions ?? await getPendingSyncSessions();
  
  if (pendingSessions.length === 0) {
    return { synced: 0, failed: 0, syncedIds: [], failedIds: [] };
  }

  // Filter out empty sessions (auto-discard) and delete them from local storage
  const validSessions = pendingSessions.filter(session => 
    session.routes && session.routes.length > 0
  );
  
  const emptySessions = pendingSessions.filter(session => 
    !session.routes || session.routes.length === 0
  );
  
  // Delete empty sessions from local storage immediately
  for (const emptySession of emptySessions) {
    await deleteLocalSession(emptySession.id);
  }
  
  if (validSessions.length === 0) {
    return { synced: 0, failed: 0, syncedIds: [], failedIds: [] };
  }

  // Prepare bulk payload (all sessions in one request)
  const bulkPayload = validSessions.map(localSession => ({
    startTime: localSession.startTime,
    endTime: localSession.endTime,
    notes: localSession.notes,
    routes: localSession.routes.map(route => ({
      climbId: route.climbId || null,
      isSuccess: route.isSuccess,
      attempts: route.attempts,
    })),
  }));

  // Track updates to batch save at the end
  const sessionUpdates = new Map(); // sessionId -> { status, serverSessionId }
  let synced = 0;
  let failed = 0;
  const syncedIds = [];
  const failedIds = [];

  try {
    const response = await api.post('/sessions/sync/bulk', bulkPayload);
    const { results } = response.data;

    // Process results and track updates
    results.forEach((result, index) => {
      const localSession = validSessions[index];
      
      if (result.success) {
        sessionUpdates.set(localSession.id, {
          status: 'synced',
          serverSessionId: result.sessionId,
        });
        synced++;
        syncedIds.push(localSession.id);
        
        if (onProgress) {
          onProgress(localSession.id, 'synced', { 
            sessionId: result.sessionId, 
            isDuplicate: result.isDuplicate 
          });
        }
      } else {
        sessionUpdates.set(localSession.id, {
          status: 'sync_failed',
        });
        failed++;
        failedIds.push(localSession.id);

        if (onProgress) {
          onProgress(localSession.id, 'failed', { error: result.error });
        }

        if (showErrors) {
          showErrorAlert(`Failed to sync session: ${result.error || 'Unknown error'}`);
        }
      }
    });
  } catch (error) {
    console.error('Failed to sync sessions in bulk:', error);
    
    // If bulk call fails entirely, mark all as failed
    validSessions.forEach(localSession => {
      sessionUpdates.set(localSession.id, {
        status: 'sync_failed',
      });
      failed++;
      failedIds.push(localSession.id);

      if (onProgress) {
        onProgress(localSession.id, 'failed', { error });
      }
    });

    if (showErrors) {
      // Only show error for non-network errors (network errors are expected offline)
      if (error.response?.status && error.response.status !== 0) {
        showErrorAlert(`Failed to sync sessions: ${error.response?.data?.error || error.message}`);
      }
    }
  }

  // Batch update all sessions at once (one read, one write instead of N reads/writes)
  if (sessionUpdates.size > 0) {
    await batchUpdateLocalSessions(sessionUpdates);
  }

  return { synced, failed, syncedIds, failedIds };
}

export async function syncSingleSession(api, localSessionId) {
  const localSession = await getLocalSession(localSessionId);

  if (!localSession) {
    return { success: false, error: new Error('Session not found') };
  }

  // Auto-discard: If no routes, delete and return
  if (!localSession.routes || localSession.routes.length === 0) {
    await deleteLocalSession(localSessionId);
    return { success: false, error: new Error('Session discarded - no routes') };
  }

  if (localSession.status === 'synced') {
    return { success: true, sessionId: localSession.serverSessionId };
  }

  try {
    const payload = {
      startTime: localSession.startTime,
      endTime: localSession.endTime,
      notes: localSession.notes,
      routes: localSession.routes.map(route => ({
        climbId: route.climbId || null,
        isSuccess: route.isSuccess,
        attempts: route.attempts,
      })),
    };

    const response = await api.post('/sessions/sync', payload);
    const { sessionId } = response.data;

    await updateLocalSession(localSessionId, {
      status: 'synced',
      serverSessionId: sessionId,
    });

    return { success: true, sessionId };
  } catch (error) {
    await updateLocalSession(localSessionId, {
      status: 'sync_failed',
    });

    return { success: false, error };
  }
}
