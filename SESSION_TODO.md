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

3. **Session insights/analytics**
   - Derive insights from user session data
   - Examples: "mostly doing V5s in overhangs", success rate by descriptor, grade progression patterns
   - Display trends and patterns over time

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
