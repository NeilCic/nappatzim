# Session Insights UI - Planning Document

## Overview
Backend is complete (`GET /sessions/insights`). This document outlines the frontend implementation plan.

---

## Screen Location Options

### Option 1: ProfileScreen (Recommended)
**Pros:**
- Natural place for user analytics/insights
- Already has link to "View Climbing Sessions"
- User-centric information location
- Easy to access

**Cons:**
- Might make ProfileScreen busy if there's a lot of content

**Implementation:**
- Add "Insights" section below username/height settings
- Show summary card or link to detailed insights
- Could be expandable/collapsible section

---

### Option 2: SessionHistoryScreen
**Pros:**
- Directly related to sessions
- Users already viewing session data
- Contextual placement

**Cons:**
- Might clutter the session list view
- Insights are more about overall progress, not individual sessions

**Implementation:**
- Add insights section at top of session list
- Or separate tab "History" | "Insights"

---

### Option 3: New InsightsScreen
**Pros:**
- Dedicated space for detailed insights
- Can show all data without feeling cramped
- Future-proof for additional analytics

**Cons:**
- Extra navigation step
- More screens to maintain

**Implementation:**
- Create new `InsightsScreen.js`
- Add navigation link from ProfileScreen or SessionHistoryScreen

---

## Recommended: ProfileScreen + Expandable Sections

### Layout Structure:
```
ProfileScreen
├── User Settings (Username, Height)
├── Quick Actions
│   └── "View Climbing Sessions" button
└── Insights Section (new)
    ├── Summary Card (if >= 5 sessions)
    │   └── "View Full Insights" button
    └── Or: Direct Insights Display (expandable sections)
```

---

## Data Structure (from backend)

```javascript
{
  hasEnoughData: boolean,
  sessionCount: number,
  minSessionsRequired: 5,
  totalRoutes: number,
  gradeSystem: string, // "V-Scale" or "YDS"
  
  gradeProfile: {
    byGrade: {
      "V5": { successRate: 75, routes: 10, sends: 8, attempts: 12 },
      // ... more grades
    },
    comfortZone: ["V4", "V5"], // >= 70% success
    challengingZone: ["V6"],    // 50-69% success
    projectZone: ["V7"],        // 20-49% success
    tooHard: ["V8"],            // < 20% success
    idealProgressionGrade: "V6" // Next grade to try
  },
  
  styleAnalysis: {
    strengths: ["dyno", "powerful"],      // >= 60% success
    weaknesses: ["balance", "technical"], // < 40% success, >= 2 attempts
    preferences: ["reachy", "dyno"]       // Most attempted (sorted by routes)
  },
  
  routeSuggestions: {
    enjoyable: [
      { id, grade, descriptors: [...], spot: {...}, layout: {...} },
      // up to 3 routes
    ],
    improve: [
      // up to 3 routes matching weaknesses at easier grade
    ],
    progression: [
      // up to 3 routes at harder grade matching strengths
    ]
  }
}
```

---

## UI Components to Build

### 1. Insights Summary Card (if < 5 sessions)
```
┌─────────────────────────────────┐
│ 📊 Session Insights             │
│                                 │
│ Log 5 sessions to unlock        │
│ your climbing insights!         │
│                                 │
│ Progress: [3/5 sessions] ████░░ │
└─────────────────────────────────┘
```

---

### 2. Grade Profile Section
```
┌─────────────────────────────────┐
│ 📈 Grade Profile                │
│                                 │
│ Comfort Zone (≥70%)             │
│ ┌─┬─┬─┬─┐                       │
│ │V4│V5│ │ │  ████ 75%, 80%      │
│ └─┴─┴─┴─┘                       │
│                                 │
│ Challenging (50-69%)            │
│ ┌─┐                             │
│ │V6│  ████ 55%                  │
│ └─┘                             │
│                                 │
│ Project (20-49%)                │
│ ┌─┐                             │
│ │V7│  ██ 30%                    │
│ └─┘                             │
│                                 │
│ Too Hard (<20%)                 │
│ ┌─┐                             │
│ │V8│  █ 10%                     │
│ └─┘                             │
│                                 │
│ 💡 Next: Try V6 routes          │
└─────────────────────────────────┘
```

**Visual Options:**
- Horizontal bar charts for each zone
- Color-coded zones (green/yellow/orange/red)
- Grade chips with success rates
- Progress bars

---

### 3. Style Analysis Section
```
┌─────────────────────────────────┐
│ 🎯 Style Analysis               │
│                                 │
│ Strengths 💪                    │
│ ┌────────┬────────┐             │
│ │ Dyno   │ 85% ✓  │             │
│ │ Powerful│ 70% ✓ │             │
│ └────────┴────────┘             │
│                                 │
│ Weaknesses 🔧                   │
│ ┌────────┬────────┐             │
│ │ Balance│ 25%    │             │
│ │Technical│ 30%   │             │
│ └────────┴────────┘             │
│                                 │
│ Style Balance (Radar Chart)     │
│         Power                   │
│           ▲                     │
│           │                     │
│    Tech ──┼── Dyno              │
│           │                     │
│      (normalized %)             │
│                                 │
│ Preferences ❤️                  │
│ ┌────────┬────────┐             │
│ │ Reachy │ 15 routes│           │
│ │ Dyno   │ 12 routes│           │
│ └────────┴────────┘             │
└─────────────────────────────────┘
```

**Display Options:**
- Tags/chips with percentages
- Icon indicators (✓ for strengths, 🔧 for weaknesses)
- Horizontal lists or grids
- **Radar Chart (Spider Chart)**: Triangular/polygonal visualization showing balance of style categories
  - If there are 3 main style categories, display as a triangle
  - Center point = 0% for that category
  - Each vertex/tip = 100% for that category
  - Plot point shows user's normalized distribution (e.g., if one category is 100% and others 0%, point is at that vertex)
  - Useful for visualizing strengths/weaknesses balance at a glance

---

### 4. Route Suggestions Section
```
┌─────────────────────────────────┐
│ 💡 Route Suggestions            │
│                                 │
│ Enjoyable Routes                │
│ ┌─────────────────────────────┐ │
│ │ V5 - Dyno, Powerful         │ │
│ │ Performance TLV - Spot A    │ │
│ │ [View Route →]              │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ V5 - Reachy, Explosive      │ │
│ │ Performance TLV - Spot B    │ │
│ │ [View Route →]              │ │
│ └─────────────────────────────┘ │
│                                 │
│ Improve Your Skills             │
│ ┌─────────────────────────────┐ │
│ │ V4 - Balance, Technical     │ │
│ │ Performance TLV - Spot C    │ │
│ │ [View Route →]              │ │
│ └─────────────────────────────┘ │
│                                 │
│ Push Your Limits                │
│ ┌─────────────────────────────┐ │
│ │ V6 - Dyno, Powerful         │ │
│ │ Performance TLV - Spot D    │ │
│ │ [View Route →]              │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Route Card Fields:**
- Grade
- Descriptors (tags)
- Spot name
- Layout name
- Link to ClimbDetailScreen

---

## Navigation Flow

### From ProfileScreen:
1. User sees insights section
2. If < 5 sessions: Show progress card
3. If >= 5 sessions: Show insights or "View Insights" button
4. Clicking routes navigates to `ClimbDetailScreen`

### Route Deep Linking:
- Route suggestions should navigate: `navigation.navigate('Climb Detail', { climbId: route.id })`
- Include layout context if available

---

## State Management

### Component State:
```javascript
const [insights, setInsights] = useState(null);
const [loading, setLoading] = useState(true);
const [expandedSections, setExpandedSections] = useState({
  gradeProfile: true,
  styleAnalysis: true,
  routeSuggestions: true,
});
```

### Fetch Logic:
```javascript
useEffect(() => {
  fetchInsights();
}, []);

const fetchInsights = async () => {
  try {
    const response = await api.get('/sessions/insights');
    setInsights(response.data);
  } catch (error) {
    showError(error, 'Failed to load insights');
  } finally {
    setLoading(false);
  }
};
```

---

## UI/UX Considerations

### Loading States:
- Show skeleton/loading spinner while fetching
- Handle API errors gracefully

### Empty States:
- < 5 sessions: Show progress card with progress bar (5 bars = 1 per session needed)
- No route suggestions: Show "Keep climbing to get personalized route suggestions!"
- No weaknesses: Show "You're strong across all styles! 🎉"
- No strengths: Show "Keep practicing to develop your climbing strengths!"
- No style data: Show "Log more sessions with descriptors to see your style analysis"

### Refresh:
- **Pull-to-refresh**: Allow users to pull down to refresh insights data (useful across all screens)
- **Auto-refresh on focus**: When navigating back to ProfileScreen from completing a session, automatically refresh insights to show updated data (using React Navigation's `useFocusEffect` hook)

### Animations:
- Expand/collapse sections smoothly
- Progress bars animate on load
- Route cards slide in

---

## Styling Considerations

### Colors:
- Comfort Zone: Green (#4CAF50)
- Challenging: Yellow/Orange (#FF9800)
- Project: Orange (#FF5722)
- Too Hard: Red (#F44336)
- Strengths: Green accent
- Weaknesses: Yellow/Orange accent

### Typography:
- Section headers: Bold, 18-20px
- Grade labels: Medium, 16px
- Percentages: Bold, highlighted
- Route names: Medium, 16px

### Spacing:
- Consistent padding between sections
- Card spacing: 12-16px
- Internal padding: 16px

---

## Future Enhancements (Post-MVP)

1. **Charts/Graphs**
   - Grade distribution bar chart
   - Success rate over time
   - Style preference pie chart
   - **Radar/Spider chart for style balance** (triangular visualization of strengths/weaknesses distribution)

2. **Comparison**
   - Compare insights across time periods
   - "Last month vs this month"

3. **Badges/Achievements**
   - "Consistent Climber" (5 sessions)
   - "Style Specialist" (strong in one style)
   - "All-Arounder" (balanced across styles)

4. **Share**
   - Share insights as image
   - Export insights data

5. **Filtering**
   - Insights by date range
   - Insights by gym/layout

---

## Questions to Decide Tomorrow

1. **Screen Location:**
   - ✅ ProfileScreen (recommended)
   - SessionHistoryScreen
   - New InsightsScreen

2. **Display Style:**
   - All insights on one scrollable screen?
   - Expandable/collapsible sections?
   - Tabs for each section?

3. **Route Suggestions:**
   - Show all 3 categories always?
   - Allow filtering by category?
   - Show route preview images?

4. **Grade Profile Visualization:**
   - Simple bars/chips?
   - Horizontal bar chart?
   - Vertical stacked chart?

5. **Empty States:**
   - How detailed should progress card be?
   - Show example insights to motivate?

6. **Navigation:**
   - How to handle layout context when viewing suggested routes?
   - Should suggestions include layout info?

---

## Implementation Order

1. **Setup** (30 min)
   - Create/update component structure
   - Add API call function
   - Set up state management

2. **Summary Card** (30 min)
   - < 5 sessions state
   - Progress indicator

3. **Grade Profile** (1-2 hours)
   - Display zones
   - Success rate visualization
   - Ideal progression grade

4. **Style Analysis** (1-2 hours)
   - Strengths/weaknesses/preferences
   - Tag/chip display
   - Radar chart visualization (triangular/polygonal) for style balance (if 3+ categories)

5. **Route Suggestions** (1-2 hours)
   - Route cards
   - Navigation to ClimbDetailScreen
   - Handle empty states

6. **Polish** (1 hour)
   - Styling consistency
   - Loading states
   - Error handling
   - Animations

**Estimated Total:** 5-7 hours

---

## Files to Create/Modify

### New Files:
- `mobile/src/components/InsightsSection.js` (optional, if reusable)
- `mobile/src/components/GradeProfileCard.js` (optional)
- `mobile/src/components/StyleAnalysisCard.js` (optional)
- `mobile/src/components/RouteSuggestionsCard.js` (optional)

### Modify Files:
- `mobile/src/screens/ProfileScreen.js` (add insights section)
- Potentially: `mobile/src/screens/SessionHistoryScreen.js` (if adding link there)

### API Integration:
- Already have: `api.get('/sessions/insights')`
- No changes needed to backend

---

## Testing Checklist

- [ ] < 5 sessions shows progress card
- [ ] >= 5 sessions shows full insights
- [ ] Loading state displays correctly
- [ ] Error handling works
- [ ] Route suggestions navigate correctly
- [ ] Grade zones display correctly
- [ ] Style analysis shows all categories
- [ ] Empty states handled (no weaknesses, no suggestions)
- [ ] Pull-to-refresh (if implemented)
- [ ] Responsive layout on different screen sizes

---

## Notes

- Backend returns everything in one API call ✅
- Route suggestions include full route/spot/layout data ✅
- Grade system auto-detected from first route ✅
- All thresholds are configurable (but hardcoded in backend for now) ✅
