# Session Logging - Implementation Plan

## Overview
Track climbing sessions to record routes attempted, success/failure status, and number of attempts. This data will be used for progress tracking, analytics, and insights - even after routes are deleted.

---

## 1. What a Session Looks Like

A session is a list of routes with:
- **Route info (snapshotted at time of logging)**:
  - Proposed grade
  - Voter grade (average of all votes)
  - Descriptors (from votes)
- **Status**: Success / Failure (boolean)
- **Attempt count**: Number of tries (1+)
- **Session-level notes** (not per-route)
- **Session duration** (start/stop time, with pause/break support)

**Visual representation:**
```
[Session] Jan 15, 2024 - 2h 15m
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ V5 (Dyno) - Success (2 attempts)
✗ V6 (Crimpy, Powerful) - Failure (5 attempts)
✓ V4 (Balanced) - Success (1 attempt)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Session notes: "Great session, feeling strong!"
```

---

## 2. Where to Create a Session

**From LayoutDetailScreen:**
- Add "Start Session" button **under the filters button** (good location, near routes)
- Button is visible when no session is active
- When clicked, session starts and button changes to "End Session"
- Visual indicator shows session is active

---

## 3. Session Flow & UX

### 3.1 Starting a Session
1. User is on `LayoutDetailScreen`
2. Taps "Start Session" button (under filters)
3. Session starts (timestamp recorded)
4. Button changes to "End Session"
5. Visual indicator: "Session Active - Tap routes to log"

### 3.2 Logging Routes During Session
**Important**: When a session is active, route tap behavior changes:
- **Normal state** (no active session): Tap route → Opens route detail screen (existing behavior)
- **Active session state**: Tap route → Opens quick-add modal for logging

1. User taps a route on map/list view (during active session)
2. Quick-add modal opens:
   - **Status**: Success / Failure (toggle or buttons)
   - **Attempts**: Counter (+/- buttons, default 1, min 1)
   - "Add to Session" / "Cancel" buttons
3. Route is added to session
4. Modal closes
5. Route shows visual indicator (badge/border) that it's logged

### 3.3 Viewing Active Session
- Floating panel or expandable section showing:
  - "Session: X routes"
  - List of logged routes with status and attempts
  - Quick edit/remove for each route
  - "End Session" button

### 3.4 Session Duration Tracking
- **Start**: When user taps "Start Session" (timestamp saved)
- **Stop**: When user taps "End Session" (timestamp saved)
- **Pause/Break** (optional for v1):
  - Add "Pause" button during active session
  - Pause time not counted in duration
  - "Resume" button to continue
  - Multiple pause/resume cycles allowed
- Duration = (End time - Start time) - (Total pause duration)

### 3.5 Ending/Saving Session
1. User taps "End Session"
2. **Confirmation alert appears**: "End session? This will save your logged routes." [Cancel] [End Session]
3. If confirmed, review modal opens:
   - List of all logged routes
   - Edit any route (status, attempts)
   - Add session notes
   - Review session duration
4. "Save Session" saves and closes
5. Return to normal `LayoutDetailScreen`
6. Button returns to "Start Session"

---

## 4. Route Metadata Snapshot (Critical!)

When a route is added to a session, **capture current state** and store in `SessionRouteAttempt`:

**What to snapshot:**
- ✅ **Proposed grade** (`Climb.grade`, `Climb.gradeSystem`)
- ✅ **Voter grade** (average of all votes at time of logging)
- ✅ **Descriptors** (all from votes, deduplicated)
- ✅ **Climb reference** (`climbId` - nullable, for linking to live route if still exists)
- ❌ ~~Route color~~ (removed - not important long-term, user won't remember after route is deleted)
- ❌ ~~Setter name~~ (removed - progress is gym-agnostic)
- ❌ ~~Layout info~~ (removed - progress is gym-agnostic)

**Snapshot Update Strategy:**
- **Snapshot at log time**: When route is added to session, capture current state (proposed grade, voter grade, descriptors)
- **Update on route deletion**: When a route is deleted, automatically update all `SessionRouteAttempt` records that reference it with the final state
- **Manual update option**: Add "Update Metadata" button in session detail view for user control (updates snapshot from current route state)

**Why this matters:**
- Routes get replaced every few weeks
- Historical data remains intact for analytics:
  - "How many V5s have I sent?" (aggregate by grade)
  - "I send more dyno routes" (style analysis by descriptors)
  - "V5 → V6 progression timeline" (grade tracking over time)
  - "Send rate by descriptors" (e.g., success rate on crimpy vs dyno routes)

**Storage:**
- Store snapshot data in `SessionRouteAttempt` model
- Reference `climbId` for now (for linking to live route if still exists)
- But snapshot data is the source of truth for historical analytics

---

## 5. Viewing Past Sessions

### Session History Screen
- List of sessions (most recent first)
- Each item shows:
  - Date/time
  - Routes count: "5 routes, 3 sends"
  - Duration: "2h 15m"
  - Average proposed grade: "V5"
  - Average voted grade: "V5.5"
- Tap to open session detail

### Session Detail Screen
- **Session metadata**: 
  - Date, Duration, Notes
  - Average proposed grade (across all routes in session)
  - Average voted grade (across all routes in session)
- **Route list**:
  - Each route shows: Grade (proposed + voter), Descriptors, Status (✓/✗), Attempts
  - Tap route → View snapshot details (not live route - may be deleted)
- **Actions**: Edit session, Delete session, Update route metadata (if route still exists)

---

## 6. Database Schema (Technical - for reference)

### Models Needed:
1. **ClimbingSession**
   - `id`, `userId`, `startTime`, `endTime`, `duration` (calculated), `notes`, `createdAt`, `updatedAt`
   - Relations: `User`, `SessionRouteAttempt[]`

2. **SessionRouteAttempt**
   - `id`, `sessionId`, `climbId` (nullable - for reference if route still exists)
   - **Snapshot data** (critical!):
     - `proposedGrade`, `gradeSystem`
     - `voterGrade` (average)
     - `descriptors` (String[])
   - `status` (enum: 'success' | 'failure')
   - `attempts` (Int, min 1)
   - `createdAt`, `updatedAt`
   - Relations: `ClimbingSession`, `Climb?` (optional - route may be deleted)

### Indexes:
- `ClimbingSession`: `[userId, createdAt]`
- `SessionRouteAttempt`: `[sessionId]`, `[climbId]`, `[sessionId, climbId]` (unique)

---

## 7. UI/UX Details

### LayoutDetailScreen Changes:
- Add "Start Session" button **under the filters button** (positioned well, near routes)
- Button state:
  - **Inactive**: "Start Session" (green/primary)
  - **Active**: "End Session" (red/secondary)
- When active, show visual indicator (badge or banner): "Session Active - X routes logged"

### Quick-Add Modal (when tapping route during active session):
```
┌─────────────────────────────────────┐
│ Route: V5 (Dyno)                    │
│ Voter Grade: V5                     │
│ Descriptors: Dyno, Powerful         │
│                                     │
│ Status:                             │
│ [✓ Success] [✗ Failure]            │
│                                     │
│ Attempts: [−] 2 [+]                 │
│                                     │
│ [Cancel] [Add to Session]           │
└─────────────────────────────────────┘
```

### Active Session Panel (floating or expandable):
```
┌─────────────────────────────────────┐
│ 🎯 Session Active                   │
│ Duration: 1h 23m                    │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ ✓ V5 (Dyno) - 2 attempts            │
│ ✗ V6 (Crimpy) - 5 attempts          │
│ ✓ V4 (Balanced) - 1 attempt         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ [End Session]                       │
└─────────────────────────────────────┘
```

---

## 8. Implementation Phases

### Phase 1: MVP (Core Functionality)
1. ✅ Database schema + migration
2. ✅ Backend service + controller + routes
3. ✅ "Start Session" button in LayoutDetailScreen
4. ✅ Quick-add modal when tapping routes during active session
5. ✅ Basic session saving (status: success/failure, attempts)
6. ✅ Route metadata snapshot (grade, voter grade, descriptors, color)
7. ✅ Session duration tracking (start/stop)
8. ✅ Session notes
9. ✅ Session history screen
10. ✅ Session detail screen

### Phase 2: Enhancements
1. Active session panel (floating/expandable)
2. Edit routes in active session
3. Pause/resume session (break tracking)
4. Visual indicators for logged routes
5. Session filters (by date, duration)

### Phase 3: Future Features
1. Session templates ("Projecting Day", "Volume Day")
2. Quick actions (swipe to mark as success)
3. Offline support (log locally, sync later)
4. Voice notes for session
5. Photos/videos linked to session
6. Route discovery ("Routes you haven't tried yet")
7. Session statistics/insights

---

## 9. Key Decisions & Rationale

1. **Status: Success/Failure only**
   - Attempted/worked on can be inferred from attempt count
   - Simpler UI, less cognitive load
   - Binary status is clear and actionable

2. **No per-route notes**
   - Session-level notes are sufficient
   - Reduces complexity in UI
   - Can add later if needed

3. **Snapshot route metadata**
   - Critical for historical analytics
   - Enables progress tracking even after routes deleted
   - Must capture: grade, voter grade, descriptors
   - Color not stored (not important long-term)
   - Snapshot at log time, update on route deletion, manual update option available

4. **No setter/layout in snapshot**
   - Progress should be gym-agnostic
   - User might climb at multiple gyms
   - Focus on personal progression, not location

5. **Session duration with pause/break**
   - Valuable metric for tracking
   - Pause/break optional for v1 (can add later)
   - Start/stop is essential

6. **Button placement under filters**
   - Good location, near routes
   - Visible and accessible
   - Fills available space

---

## 10. Open Questions / Future Considerations

1. **Multiple sessions per day?** ✅ Yes, allow multiple sessions
2. **Active session persistence?** Store in AsyncStorage, resume on app reopen
3. **Route already logged?** Prevent duplicates or allow updates?
4. **Session sharing?** (Future) Share sends with friends/social feed
5. **Voice notes?** (Future) Record notes while climbing
6. **Photos/videos?** (Future) Link media to specific routes in session
7. **Route discovery?** (Future) "Routes you haven't tried yet" view
8. **Session statistics?** (Future) Quick stats in session panel

---

## 11. Open Questions Before Implementation

### Route Click Behavior
- ✅ **Resolved**: When session is active, route tap opens quick-add modal instead of route detail screen
- **Implementation detail**: Need to conditionally handle route tap based on `isSessionActive` state

### Route Metadata Updates
- ✅ **Resolved**: Snapshot at log time, update on route deletion, manual update button available
- **Implementation detail**: Need to add hook/listener for route deletion events to trigger snapshot updates

### Duplicate Routes in Session
- **Question**: Can the same route be logged multiple times in one session? (e.g., tried it 3 times, failed, then came back later and sent it)
- **Options**: 
  - Allow multiple entries (same route, different attempts/status)
  - Prevent duplicates (only one entry per route per session)
  - Allow updates (replace existing entry if route already logged)

### Active Session Persistence
- **Question**: If user closes app during active session, should we:
  - Auto-save session and resume on reopen?
  - Discard session and require restart?
  - Prompt user to save or discard?

### Route Already Logged Indicator
- **Question**: How should we indicate a route is already logged in the active session?
- **Options**:
  - Visual badge/border on route marker
  - Show in active session panel only
  - Disable route tap (prevent re-logging) or allow updates?

### Session History Access
- **Question**: Where should users access session history?
- **Options**:
  - New "Sessions" tab in main navigation
  - Profile screen section
  - Home screen widget/section

### Average Grade Calculation
- **Question**: For average grades in session history, should we:
  - Use proposed grades only?
  - Use voted grades only?
  - Show both averages separately? ✅ (decided: show both)

### Quick-Add Modal Route Info
- **Question**: Should quick-add modal show:
  - Current route state (live data)?
  - Snapshot preview (what will be saved)?
  - Both?

### Session Notes Character Limit
- **Question**: Should there be a character limit for session notes?
- **Options**: No limit, 500 chars, 1000 chars, etc.

### Route Metadata Update Button Location
- **Question**: Where should "Update Metadata" button appear?
- **Options**:
  - In session detail screen (per route or bulk update)
  - In route detail screen (if route still exists)
  - Both?

---

## Notes

- Focus on **simplicity** and **speed** - logging should be fast
- **Snapshot data is critical** - don't skip this step
- **Status is boolean** - success/failure, not multiple states
- **Session-level notes only** - keep it simple for v1
- **Button placement** - under filters, good location near routes
- **Confirmation on end session** - prevent accidental session termination
- **Route click behavior** - changes based on active session state
- **Color not stored** - not important for long-term analytics
