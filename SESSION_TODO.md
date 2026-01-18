# Session Logging - TODO

## Remaining Tasks

### Phase 2: Enhancements
1. **Active session panel (floating/expandable)**
   - Show current session routes in a floating/expandable panel
   - Display route count, duration
   - Quick edit/remove for each route
   - "End Session" button accessible from panel

### Phase 3: Future Features
1. **Offline support** (log locally, sync later)
   - Store session data locally when offline
   - Sync to backend when connection restored

2. **Route discovery** ("Routes you haven't tried yet")
   - Filter/section showing routes user hasn't logged in sessions
   - Help users discover new routes to try

3. **Session insights/analytics** (requires minimum 5 sessions)
   - **Grade Profile** ✅:
     - Success rate by grade (sends/total attempts)
     - Comfort zone: high success rate (>70%)
     - Project zone: medium success rate (30-50%), attempting regularly
     - Too hard: very low success rate (<20%)
     - Ideal progression grade: next grade up from comfort zone
     - Backend: `GET /sessions/insights/grade-profile`
   
   - **Style Analysis**:
     - Track descriptors across all routes: total routes, successful routes, failed routes, total attempts
     - Strengths: descriptors with high success rate (>60%)
     - Weaknesses: descriptors with low success rate (<40%) but attempts made
     - Preferences: most attempted descriptors (even if success is lower) - sorted by total routes
     - Future: Descriptor combinations (e.g., "dyno + powerful") for specialized badges/identities
     - Backend: `GET /sessions/insights/style-analysis`
   
   - **Route Suggestions** (displayed in profile page, up to 3 per category):
     - **Enjoyable**: Match strengths at comfort/progression grade
     - **Improve**: Match weaknesses at slightly easier grade (focus on technique)
     - **Progression**: Slightly harder grade in same style (push comfort zone)

### Technical Debt / Maintenance
1. **Reanimated Migration (runOnJS deprecation)**
   - Migrate from deprecated `runOnJS` to `scheduleOnRN` from `react-native-worklets` (Reanimated 4.x migration)
   - Location: `mobile/src/screens/LayoutDetailScreen.js` (2 calls in SwipeableRouteItem component)
   - Steps: 
     1. Install `react-native-worklets` package
     2. Replace `runOnJS` imports and calls with `scheduleOnRN` from `react-native-worklets`
     3. Update import statement from `react-native-reanimated` to `react-native-worklets`

2. **Swipe Feature Limitation (Map View)**
   - Current state: Swipe-to-add feature only works in **list view**, not in **map view**
   - Reason: SwipeableRouteItem component is only used in the FlatList renderItem for list view; map view uses spot markers that open a modal
   - Future enhancement: Implement swipe gestures for routes in map view modal (if desired)

3. **Grade System Preference**
   - **Future feature**: Allow users to pick their preferred grading system for insights/analytics
   - Currently assumes single grade system per user (uses first encountered)
   - Would need user preference setting and UI to select preferred system
   - For now, stick with current implementation (auto-detect from first route)

---

## Completed Features

### Phase 1: MVP ✅
- Database schema + migration
- Backend service + controller + routes
- "Start Session" button in LayoutDetailScreen
- Quick-add modal when tapping routes during active session
- Basic session saving (status: success/failure, attempts)
- Route metadata snapshot (grade, voter grade, descriptors)
- Session duration tracking (start/stop)
- Session notes
- Session history screen
- Session detail screen

### Phase 2: Enhancements ✅
- Edit routes in active session
- Visual indicators for logged routes (logbook icons)
- Session filters (by date, duration, avg grades)

### Phase 3: Future Features ✅
- Quick actions (swipe to mark as success) - *Note: Only works in list view, not map view*
- Session statistics (Total routes, sends, failed, attempts, average grades)

---

## Removed/Not Needed
- Pause/resume session (break tracking)
- Session templates ("Projecting Day", "Volume Day")
- Voice notes for session
- Photos/videos linked to session
