# Offline Session Logging - TODO

## Phase 1: Client-First Sessions (Snapshot Sync) ✅ COMPLETE

1. **Local Session Model** ✅
   - ✅ Defined `LocalSession` shape with JSDoc in `localSessionStorage.js`
   - ✅ Stores array of `LocalSession` objects in AsyncStorage

2. **Active Session Uses LocalSession Only** ✅
   - ✅ Refactored `LayoutDetailScreen` to use `LocalSession` model
   - ✅ Creates `LocalSession` when starting session (no immediate API calls)
   - ✅ Updates `LocalSession` routes/notes locally
   - ✅ Marks session as `completed` when user ends session

3. **Sync Endpoint (Backend)** ✅
   - ✅ `POST /sessions/sync` endpoint accepts full session snapshot
   - ✅ Creates `ClimbingSession` and bulk inserts `SessionRoute` rows in transaction
   - ✅ Returns `{ sessionId }`

4. **Sync Engine (Frontend)** ✅
   - ✅ `syncLocalSessions()` function in `sessionSync.js`
   - ✅ Finds all `LocalSession` with `status === "completed"` or `"sync_failed"`
   - ✅ Marks as `synced` on success, `sync_failed` on failure
   - ✅ Triggers sync on app start (HomeScreen)
   - ✅ Manual sync button in ProfileScreen

5. **UI States** ✅
   - ✅ Shows pending sessions count in ProfileScreen sync button
   - ✅ Active session UI shows local session state

## Phase 2: Enhancements (Nice-to-have)

1. **Background Sync / Connectivity Awareness** ❌ NOT IMPLEMENTED
   - Use network status to automatically trigger sync when coming back online.
   - Backoff on repeated failures.

2. **Bulk Sync Endpoint** ✅ COMPLETE
   - ✅ `POST /sessions/sync/bulk` endpoint accepts array of sessions
   - ✅ `syncLocalSessions` batches sessions (sends all at once)
   - ✅ Handles partial failures gracefully (some succeed, some fail)
   - ✅ More efficient than individual API calls (reduced from N calls to 1 call)

3. **Conflict Handling** ❌ NOT IMPLEMENTED
   - Define behavior if a session was already synced from another device (future multi-device support).

4. **Richer Local Data** ❌ NOT IMPLEMENTED
   - Allow attaching more metadata to offline sessions (e.g. per-route notes) and include them in the snapshot.

