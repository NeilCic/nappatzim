# Rest Day Insights - Planning Document

## Overview
Personalized rest day insights based on individual climber patterns and performance anomalies. This feature analyzes each user's climbing history to identify when rest may be beneficial, and monitors recovery patterns after rest periods.

## Core Philosophy
- **Personalized**: Each climber has unique patterns, recovery rates, and volume tolerance
- **Data-driven**: Requires sufficient historical data to establish baselines
- **Insights, not predictions**: We observe patterns and suggest, not dictate
- **Continuous learning**: Baselines evolve as we gather more data

---

## Data Available

### Session Data
- `startTime`, `endTime` → Session duration, date
- `notes` → Optional user notes

### Route Attempt Data (SessionRoute)
- `attempts` → Number of attempts per route
- `status` → 'success' or 'failure'
- `proposedGrade`, `voterGrade` → Grades attempted/sent
- `descriptors` → Route characteristics

### Calculated Metrics (per session)
- Total attempts (sum of all route attempts)
- Total routes tried (count of SessionRoute)
- Success rate (successful routes / total routes)
- Average attempts per route
- Highest grade sent
- Average grade sent
- Session duration (hours)

---

## Baseline Establishment

### Minimum Data Requirements
- **Minimum sessions**: ~10-15 sessions to establish initial baseline
- **Ideal**: 20+ sessions for reliable patterns
- **Time span**: At least 2-3 weeks of data to see patterns

### Baseline Metrics (per user)

1. **Climbing Frequency**
   - Average days per week (e.g., 2.5 days/week)
   - Typical rest intervals (e.g., 1-2 days between sessions)
   - Maximum consecutive days observed

2. **Performance Baseline**
   - Average success rate (e.g., 65%)
   - Typical success rate range (e.g., 55-75%)
   - Average grade sent (numeric)
   - Typical grade range

3. **Volume Baseline**
   - Average attempts per session (e.g., 25 attempts)
   - Typical attempts range (e.g., 15-35)
   - Average routes tried per session
   - Average session duration

4. **Efficiency Baseline**
   - Average attempts per successful send
   - Typical attempts per send range

---

## Anomaly Detection

### Performance Anomalies (Key Indicators)

1. **Significantly Lower Success Rate**
   - Threshold: 30-40% below user's average
   - Example: User averages 65%, session shows 40% → anomaly
   - Consider: Recent volume, consecutive days, time since rest

2. **Lower Grades Sent**
   - User typically sends V5-V6, but only sent V4 → potential fatigue
   - Compare to recent sessions (not just overall average)

3. **Higher Attempts Per Send**
   - User typically sends in 2-3 attempts, now taking 5-6 attempts
   - Indicates decreased efficiency

4. **Volume + Performance Combination**
   - High volume session (above average) + low performance → likely fatigue
   - Consecutive high-volume days + performance drop → strong indicator

### Context Factors

1. **Consecutive Days**
   - Track days since last rest
   - Compare to user's typical pattern
   - Flag if significantly above average (e.g., 4+ days when typical is 2-3)

2. **Recent Volume Accumulation**
   - Total attempts in last 3-5 days
   - Compare to user's typical weekly volume
   - High accumulation + performance drop → indicator

3. **Time Since Last Rest**
   - Days since last rest day (no climbing)
   - Compare to user's typical rest interval

---

## Rest Day Identification

### When to Suggest Rest (Insights)

1. **Performance Anomaly + Context**
   - Session shows significantly lower performance
   - AND: Consecutive days above typical pattern
   - AND/OR: Recent high volume

2. **Pattern Recognition**
   - User has climbed X consecutive days (above their typical)
   - Performance starting to trend downward
   - Volume accumulating beyond typical

3. **Historical Pattern Match**
   - User's past shows: after Y consecutive days, performance drops
   - Current situation matches that pattern

### Insight Format

**Not**: "You should rest tomorrow"

**Instead**: 
- "Your session today had a 40% lower success rate than your average (40% vs 65%). You've climbed 4 consecutive days, which is more than your usual 2-3 days/week pattern. This might indicate fatigue."
- "You typically rest after high-volume sessions. Your last 3 sessions totaled 85 attempts, and today's performance was below average."

---

## Recovery Monitoring

### After Rest Day Detection

Track performance in sessions following rest periods:

1. **Immediate Recovery Pattern**
   - User performs better immediately after rest
   - Success rate jumps back to/above baseline
   - Lower attempts per send
   - Higher grades sent

2. **Gradual Recovery Pattern**
   - User needs 2-3 sessions to return to baseline
   - Gradual improvement over multiple sessions
   - Performance slowly increases

3. **No Recovery Pattern**
   - Performance doesn't improve after rest
   - May indicate other factors (overtraining, injury, technique issues)
   - Flag for different insights

### Recovery Metrics

- Success rate in first session after rest
- Success rate trend over next 2-3 sessions
- Time to return to baseline performance
- Volume tolerance after rest

### Learning from Recovery

- Update user's recovery profile
- Identify optimal rest intervals for this user
- Refine rest day suggestions based on what works for them

---

## Implementation Plan

### Phase 1: Baseline Calculation Service

**Backend Service**: `restDayInsightsService.js`

1. **Calculate User Baseline**
   ```javascript
   calculateUserBaseline(userId) {
     // Get all completed sessions
     // Calculate:
     // - Average days per week
     // - Average success rate
     // - Average attempts per session
     // - Typical grade range
     // - Rest interval patterns
   }
   ```

2. **Session Analysis**
   ```javascript
   analyzeSession(sessionId, userId) {
     // Compare session metrics to user baseline
     // Identify anomalies
     // Calculate context factors
     // Return insight if anomaly detected
   }
   ```

### Phase 2: Anomaly Detection

1. **Performance Comparison**
   - Compare current session to baseline
   - Flag significant deviations
   - Consider context (consecutive days, recent volume)

2. **Pattern Matching**
   - Identify if current situation matches historical patterns
   - User's past: after X days, performance drops
   - Current: X days climbed → suggest rest

### Phase 3: Recovery Tracking

1. **Post-Rest Monitoring**
   - Track sessions after identified rest periods
   - Measure recovery patterns
   - Update user's recovery profile

2. **Recovery Pattern Classification**
   - Immediate recovery
   - Gradual recovery
   - No recovery (flag for investigation)

### Phase 4: Insights API & UI

**Backend Endpoint**: `GET /sessions/rest-insights`

Response:
```json
{
  "hasEnoughData": true,
  "baseline": {
    "avgDaysPerWeek": 2.5,
    "avgSuccessRate": 65,
    "avgAttemptsPerSession": 25,
    "typicalRestInterval": 1.5
  },
  "currentContext": {
    "consecutiveDays": 4,
    "recentVolume": 85,
    "daysSinceLastRest": 3
  },
  "insights": [
    {
      "type": "performance_anomaly",
      "severity": "moderate",
      "message": "Your session today had a 40% lower success rate than your average...",
      "suggestedAction": "Consider resting to recover"
    }
  ],
  "recoveryPattern": {
    "type": "immediate", // or "gradual" or "unknown"
    "avgRecoveryTime": 1, // sessions to return to baseline
    "lastObserved": "2026-01-15"
  }
}
```

**Frontend**: Add to ProfileScreen insights section
- Show rest day insights when anomalies detected
- Display recovery patterns
- Historical view of rest day effectiveness

---

## Edge Cases & Considerations

1. **Insufficient Data**
   - Need minimum sessions before providing insights
   - Show: "Log more sessions to unlock rest day insights"

2. **Changing Patterns**
   - User's routine changes (e.g., starts climbing more)
   - Baseline should adapt over time
   - Use rolling window (e.g., last 20 sessions) vs all-time

3. **Seasonal Variations**
   - User might climb more in summer, less in winter
   - Consider time-based patterns

4. **Injury/Illness**
   - Performance drops might be due to injury, not fatigue
   - Can't distinguish, but insight still valuable

5. **Different Goals**
   - Volume-focused sessions vs performance-focused
   - May need to account for session type

6. **Pro vs Beginner**
   - Pros can handle more volume/consecutive days
   - Baseline will naturally reflect this
   - No hard-coded thresholds

---

## Success Metrics

- **Accuracy**: Do insights correlate with actual fatigue?
- **User Value**: Do users find insights helpful?
- **Recovery Prediction**: Can we predict recovery patterns?
- **Pattern Recognition**: Do we correctly identify user routines?

---

## Future Enhancements

1. **Machine Learning**
   - Train model on user's historical data
   - Predict optimal rest timing
   - Predict recovery patterns

2. **Integration with Other Data**
   - Sleep data (if available)
   - Workout data (other training)
   - Calendar events (stress, travel)

3. **Proactive Suggestions**
   - "Based on your pattern, you typically perform better after 2 days rest"
   - "Your next session would benefit from rest based on recent volume"

4. **Comparative Insights**
   - "Your recovery time is typically 1 session, which is faster than average"
   - "You climb more frequently than most climbers at your level"

---

## Notes

- This is a **data science / pattern recognition** feature, not simple rule-based logic
- Requires significant data collection before being useful
- Should be presented as **insights** (observations) not **prescriptions** (commands)
- Continuous learning and adaptation is key
- Individual differences are the core principle
