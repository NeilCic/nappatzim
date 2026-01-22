# Offline Session Logging - TODO

## Phase 1: Client-First Sessions (Snapshot Sync)

1. **Local Session Model**
   - Define a `LocalSession` shape (in TypeScript/JSDoc) representing an entire session:
     - `id` (local temp id)
     - `startTime`, `endTime`, `notes`
     - `routes[]` with `climbId`, `isSuccess`, `attempts`
     - `status` (`active` | `completed` | `synced` | `sync_failed`)
   - Store an array of `LocalSession` objects in AsyncStorage.

2. **Active Session Uses LocalSession Only**
   - Refactor active session flow (in `LayoutDetailScreen`) to:
     - Create a `LocalSession` when starting a session (no immediate API calls).
     - Update the `LocalSession` routes/notes locally when logging routes or editing.
     - Mark the session as `completed` locally when user ends session.

3. **Sync Endpoint (Backend)**
   - Add `POST /sessions/offline` endpoint that accepts a full session snapshot:
     - Body: `{ startTime, endTime, notes, routes: [{ climbId, isSuccess, attempts }] }`.
   - In a transaction:
     - Create `ClimbingSession`.
     - Bulk insert `SessionRoute` rows.
   - Response: `{ sessionId }` (and optionally created route ids).

4. **Sync Engine (Frontend)**
   - Implement a simple sync function that:
     - Finds all `LocalSession` objects with `status === "completed"` and not yet synced.
     - For each, calls `POST /sessions/offline`.
     - On success: mark them as `synced` or remove from local storage.
     - On failure: mark as `sync_failed` and show a non-blocking error.
   - Trigger sync:
     - On app start.
     - On explicit "Sync now" action (e.g. button in `ProfileScreen` or `SessionHistoryScreen`).

5. **UI States**
   - Show an indicator for local-only sessions in session history (e.g. "⏳ Pending sync").
   - Show a subtle "Offline session" tag in the active session UI when not yet synced.

## Phase 2: Enhancements (Nice-to-have)

1. **Background Sync / Connectivity Awareness**
   - Use network status to automatically trigger sync when coming back online.
   - Backoff on repeated failures.

2. **Bulk Sync Endpoint** ✅
   - ✅ Create `POST /sessions/sync/bulk` endpoint that accepts an array of sessions.
   - ✅ Update `syncLocalSessions` to batch sessions (send all at once).
   - ✅ Handle partial failures gracefully (some succeed, some fail).
   - ✅ More efficient than individual API calls per session (reduced from N calls to 1 call).

3. **Conflict Handling**
   - Define behavior if a session was already synced from another device (future multi-device support).

4. **Richer Local Data**
   - Allow attaching more metadata to offline sessions (e.g. per-route notes) and include them in the snapshot.

