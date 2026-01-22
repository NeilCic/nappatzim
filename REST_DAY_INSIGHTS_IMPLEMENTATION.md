# Rest Day Insights - Implementation Guide

## Overview
This guide shows how to implement rest day insights following the existing insights pattern in the codebase.

## Key Design Decisions

1. **Background Processing**: Calculations triggered after session end (not on-demand when user requests). This means:
   - User ends session → background job processes it → if anomaly detected → alert sent
   - Proactive: User gets alerted without needing to check insights
   - Non-blocking: User can continue using app while processing happens
2. **Database Schema Required**: Need to store baseline state (can't recalculate every time)
3. **Insights vs Alerts**: 
   - **Insights**: Always shown in ProfileScreen (passive, doesn't bother user)
   - **Alerts**: Push notifications (active, user controls via toggle)
4. **Push Notifications**: Use as gateway to implement push notification infrastructure
5. **Auto-Discard Empty Sessions**: Sessions with 0 attempts deleted immediately when logged (not in background)
6. **Session Deletion**: Baseline must be recalculated when session is deleted

## Existing Calculations (What We Already Have)

We already have some calculations that can be reused:

1. **`calculateSessionStatistics(attempts)`** in `sessionService.js`:
   - `totalRoutes` - count of attempts
   - `successfulRoutes` - count of successful routes
   - `totalAttempts` - sum of all attempts
   - `averageProposedGrade`, `averageVoterGrade`

2. **`calculateGradeProgressionFromSessions(sessions)`** in `sessionService.js`:
   - Already calculates per-session: `sendRate`, `totalRoutes`, `successfulRoutes`
   - Returns progression data with session metrics

3. **Session progression data** already includes:
   - `sendRate` (success rate percentage)
   - `totalRoutes`
   - `successfulRoutes`
   - `date` (session date)

**We can reuse these calculations!** We mainly need to:
- Aggregate these per-session metrics into baseline averages
- Track consecutive days and recent volume
- Compare current session to baseline

## When Are Calculations Triggered?

### **Background Processing After Session End** ✅ (Recommended)

**When**: Automatically after user ends a session (and it's synced)
**Flow**:
1. User ends session → Session saved to DB
2. Background job triggered (async, non-blocking)
3. Calculate/update baseline if needed
4. Compare current session to baseline
5. If anomaly detected AND user has alerts enabled → Show alert
6. User can continue using app while processing happens

**Pros**: 
- Proactive: User gets alerted without needing to check
- Non-intrusive: Processing happens in background
- Timely: Alert comes soon after session, helps plan next session
- User can choose to skip next session or have a light session

**Cons**: 
- Background processing needed (can use job queue or simple async)
- Need to track baseline state in DB

**Implementation**:
- Hook into `endSessionController` or `syncOfflineSessionController`
- Trigger async calculation (don't block response)
- Use existing job queue (BullMQ) if available, or simple Promise/async

### User Preference Toggle

**Location**: ProfileScreen settings
**Purpose**: Let user opt-in/opt-out of rest day **alerts** (not insights)
**Storage**: Add `restDayAlertsEnabled` to User model

**Important Distinction**:
- **Insights**: Always shown in ProfileScreen (just data display, doesn't bother user)
- **Alerts**: Push notifications or in-app popups (can be annoying, user should control)
- **Toggle controls**: Only alerts, not insights

**Why needed**:
- Some users might find push notifications/alerts annoying
- User control over notifications
- Insights are passive (just displayed), alerts are active (interrupt user)

## Database Schema Changes

### **Yes, We Need Schema Changes** ✅

**Strategy Change**: Initially I suggested no schema changes, but that was a mistake. After your feedback about needing to track baseline state and update it regularly, schema changes are clearly required.

**Why Schema Changes Are Required**:
- **Baseline State**: Must store user's baseline metrics to compare current session against. Can't recalculate from scratch every time (performance + need persistent state)
- **Regular Updates**: Baseline updates after each session, needs to be stored and updated
- **User Preference**: Need to track if user wants alerts (insights always shown, alerts are separate - toggle only affects alerts)
- **Performance**: Storing baseline avoids expensive recalculation on every check
- **Session Deletion**: When session deleted, baseline must be recalculated (need to track baseline state)

### Required Schema Changes

1. **UserBaseline Table** (Required):
   ```prisma
   model UserBaseline {
     id                    String   @id @default(cuid())
     userId                String   @unique
     
     // Baseline metrics
     avgDaysPerWeek        Float
     avgSuccessRate        Float
     avgAttemptsPerSession Float
     avgRoutesPerSession   Float
     avgDurationHours      Float
     
     // Typical ranges (for anomaly detection)
     typicalSuccessRateMin Float
     typicalSuccessRateMax Float
     
     // Metadata
     sessionCount          Int      // Number of sessions used in baseline
     lastCalculatedAt      DateTime @default(now())
     lastUpdatedAt         DateTime @updatedAt
     
     user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)
     
     @@index([userId])
   }
   ```

2. **Add to User Model** (or separate UserPreferences):
   ```prisma
   model User {
     // ... existing fields
     restDayAlertsEnabled  Boolean  @default(true)  // User preference toggle
     // ... rest of fields
   }
   ```

### Baseline Update Strategy

**When to Update Baseline**:
- After every new session (incrementally update)
- Or recalculate every N sessions (e.g., every 5 sessions)
- Or recalculate when sessionCount changes significantly

**Update Logic**:
```javascript
// Option 1: Incremental update (faster)
updateBaselineIncremental(userId, newSession) {
  // Get current baseline
  // Add new session metrics
  // Recalculate averages (weighted)
  // Update typical ranges if needed
}

// Option 2: Full recalculation (more accurate, slower)
recalculateBaseline(userId) {
  // Get all sessions
  // Recalculate all metrics from scratch
  // Update baseline record
}
```

**Recommendation**: 
- Start with **full recalculation** every session (simple, accurate)
- Optimize to incremental later if performance becomes issue
- For users with 100+ sessions, maybe recalculate every 5-10 sessions

### Optional: Rest Period Tracking (Future)

```prisma
model RestPeriod {
  id              String   @id @default(cuid())
  userId          String
  startDate       DateTime
  endDate         DateTime?
  wasSuggested    Boolean  @default(false)
  performanceBefore Float?  // Success rate before rest
  performanceAfter  Float?  // Success rate after rest
  recoveryPattern  String?  // "immediate", "gradual", "none"
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId, startDate])
}
```
- Track identified rest periods
- Monitor recovery patterns
- **Not needed for MVP** - can add later for recovery analysis

## Background Processing Implementation

### Trigger Points

1. **After Session End** (`endSessionController`):
   ```javascript
   // In endSessionController, after session is saved
   // Trigger background calculation (don't await)
   processRestDayInsights(userId, sessionId).catch(err => {
     logger.error({ userId, sessionId, error: err }, "Failed to process rest day insights");
     // Don't fail the request if background processing fails
   });
   ```

2. **After Offline Session Sync** (`syncOfflineSessionController`):
   ```javascript
   // After bulk sync, process each synced session
   results.forEach(result => {
     if (result.success) {
       processRestDayInsights(userId, result.sessionId).catch(err => {
         // Log but don't fail
       });
     }
   });
   ```

### Background Processing Function

```javascript
async function processRestDayInsights(userId, sessionId) {
  try {
    // 1. Get the session that just ended
    const session = await prisma.climbingSession.findUnique({
      where: { id: sessionId },
      include: { attempts: true },
    });

    if (!session) {
      return; // Session doesn't exist (might have been deleted)
    }

    // Note: Empty sessions are already discarded in endSessionController/syncOfflineSessionController
    // No need to check here - if we get here, session has attempts

    // 2. Get or create baseline
    let baseline = await prisma.userBaseline.findUnique({
      where: { userId },
    });

    // 4. Get all sessions to recalculate baseline
    const sessions = await prisma.climbingSession.findMany({
      where: {
        userId,
        endTime: { not: null },
      },
      include: { attempts: true },
      orderBy: { startTime: 'asc' },
    });

    // 5. Check if we have enough data
    if (sessions.length < 10) {
      return; // Not enough data yet
    }

    // 4. Calculate/update baseline
    const newBaseline = sessionService.calculateUserBaseline(sessions);
    if (newBaseline) {
      await prisma.userBaseline.upsert({
        where: { userId },
        create: {
          userId,
          ...newBaseline,
          sessionCount: sessions.length,
        },
        update: {
          ...newBaseline,
          sessionCount: sessions.length,
          lastCalculatedAt: new Date(),
        },
      });
      baseline = newBaseline;
    }

    // 5. Get most recent session
    const mostRecentSession = sessions[sessions.length - 1];
    
    // 6. Check for anomaly
    const anomaly = sessionService.detectPerformanceAnomaly(mostRecentSession, baseline);

    // 7. Check user preference
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { restDayAlertsEnabled: true },
    });

    // 8. If anomaly and alerts enabled, queue alert
    if (anomaly && user?.restDayAlertsEnabled) {
      await queueRestDayAlert(userId, anomaly);
    }
  } catch (error) {
    logger.error({ userId, sessionId, error }, "Error processing rest day insights");
    throw error;
  }
}

/**
 * Recalculate baseline after session deletion
 * Called from deleteSessionController after session is deleted
 */
async function recalculateBaselineAfterDeletion(userId) {
  try {
    // Get all remaining sessions
    const sessions = await prisma.climbingSession.findMany({
      where: {
        userId,
        endTime: { not: null },
      },
      include: { attempts: true },
      orderBy: { startTime: 'asc' },
    });

    // If less than minimum, delete baseline
    if (sessions.length < 10) {
      await prisma.userBaseline.deleteMany({
        where: { userId },
      });
      return;
    }

    // Recalculate baseline
    const newBaseline = sessionService.calculateUserBaseline(sessions);
    if (newBaseline) {
      await prisma.userBaseline.upsert({
        where: { userId },
        create: {
          userId,
          ...newBaseline,
          sessionCount: sessions.length,
        },
        update: {
          ...newBaseline,
          sessionCount: sessions.length,
          lastCalculatedAt: new Date(),
        },
      });
    }
  } catch (error) {
    logger.error({ userId, error }, "Error recalculating baseline after deletion");
    // Don't throw - deletion should succeed even if baseline update fails
  }
}
```

### Alert System

**Option 1: Push Notification** ✅ (Recommended - gateway to start using push notifications)
- Send push notification with rest day insight
- User sees alert on phone even when app is closed
- Good opportunity to implement push notification infrastructure
- More timely and effective than in-app alerts

**Option 2: In-App Alert** (Fallback if push not available)
- Store alert in database
- Show alert when user opens app
- Alert persists until dismissed
- Less intrusive but also less timely

**Option 2 Implementation**:
```prisma
model RestDayAlert {
  id        String   @id @default(cuid())
  userId    String
  message   String
  severity  String   // "high", "moderate", "low"
  sessionId String?  // Link to session that triggered it
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId, read])
}
```

```javascript
async function queueRestDayAlert(userId, anomaly) {
  // Check if user already has unread alert (avoid duplicates)
  const existingAlert = await prisma.restDayAlert.findFirst({
    where: {
      userId,
      read: false,
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      },
    },
  });

  if (existingAlert) {
    // Update existing alert if new one is more severe
    if (anomaly.severity === 'high' && existingAlert.severity !== 'high') {
      await prisma.restDayAlert.update({
        where: { id: existingAlert.id },
        data: {
          message: anomaly.insight,
          severity: anomaly.severity,
          sessionId: anomaly.sessionId,
          read: false, // Mark as unread again
        },
      });
    }
    return;
  }

  // Create new alert
  await prisma.restDayAlert.create({
    data: {
      userId,
      message: anomaly.insight,
      severity: anomaly.severity,
      sessionId: anomaly.sessionId,
    },
  });
}
```

### Frontend: Show Alerts

In `HomeScreen.js` or `ProfileScreen.js`:
```javascript
useEffect(() => {
  const fetchAlerts = async () => {
    try {
      const response = await api.get('/rest-day-alerts');
      if (response.data.alerts && response.data.alerts.length > 0) {
        // Show alert modal or banner
        const alert = response.data.alerts[0];
        Alert.alert(
          '💤 Rest Day Suggestion',
          alert.message,
          [
            { text: 'Dismiss', onPress: () => markAlertRead(alert.id) },
            { text: 'View Details', onPress: () => navigation.navigate('Rest Insights') },
          ]
        );
      }
    } catch (error) {
      // Silently fail
    }
  };
  
  fetchAlerts();
}, []);
```

## Implementation Approach

### Step 1: Database Migration

1. Add `UserBaseline` model to `schema.prisma`
2. Add `restDayAlertsEnabled` to `User` model
3. Add `RestDayAlert` model (optional, for in-app alerts)
4. Run migration: `npx prisma migrate dev`

### Step 2: Add Rest Day Insights to SessionService

Add methods to `backend/services/sessionService.js`:

```javascript
/**
 * Calculate user baseline metrics from session history
 */
calculateUserBaseline(sessions) {
  if (!sessions || sessions.length < 10) {
    return null; // Need minimum data
  }

  // Sort sessions by date
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.startTime) - new Date(b.startTime)
  );

  // Calculate session metrics
  // REUSE: We can use existing calculateSessionStatistics() or calculate from progression data
  const sessionMetrics = sortedSessions.map(session => {
    // Option A: Use existing calculateSessionStatistics()
    const stats = this.calculateSessionStatistics(session.attempts || []);
    
    // Option B: Or reuse progression calculation (already has sendRate, totalRoutes, etc.)
    // const progressionData = this.calculateGradeProgressionFromSessions([session]);
    
    const sessionDate = new Date(session.startTime);
    const endDate = session.endTime ? new Date(session.endTime) : sessionDate;
    const durationHours = (endDate - sessionDate) / (1000 * 60 * 60);

    return {
      sessionId: session.id,
      date: sessionDate,
      totalAttempts: stats.totalAttempts,
      totalRoutes: stats.totalRoutes,
      successfulRoutes: stats.successfulRoutes,
      successRate: stats.totalRoutes > 0 
        ? (stats.successfulRoutes / stats.totalRoutes) * 100 
        : 0,
      avgAttemptsPerRoute: stats.totalRoutes > 0 
        ? stats.totalAttempts / stats.totalRoutes 
        : 0,
      durationHours,
    };
  });

  // Calculate baseline averages
  const avgSuccessRate = sessionMetrics.reduce((sum, m) => sum + m.successRate, 0) / sessionMetrics.length;
  const avgAttempts = sessionMetrics.reduce((sum, m) => sum + m.totalAttempts, 0) / sessionMetrics.length;
  const avgRoutes = sessionMetrics.reduce((sum, m) => sum + m.totalRoutes, 0) / sessionMetrics.length;
  const avgDuration = sessionMetrics.reduce((sum, m) => sum + m.durationHours, 0) / sessionMetrics.length;

  // Calculate days per week
  if (sortedSessions.length < 2) return null;
  const firstDate = new Date(sortedSessions[0].startTime);
  const lastDate = new Date(sortedSessions[sortedSessions.length - 1].startTime);
  const daysSpan = (lastDate - firstDate) / (1000 * 60 * 60 * 24);
  const avgDaysPerWeek = daysSpan > 0 ? (sortedSessions.length / daysSpan) * 7 : 0;

  // Calculate typical ranges (using standard deviation or percentiles)
  const successRates = sessionMetrics.map(m => m.successRate);
  const successRateStdDev = this.calculateStdDev(successRates);
  const typicalSuccessRateRange = {
    min: Math.max(0, avgSuccessRate - successRateStdDev),
    max: Math.min(100, avgSuccessRate + successRateStdDev),
  };

  return {
    avgDaysPerWeek: Math.round(avgDaysPerWeek * 10) / 10,
    avgSuccessRate: Math.round(avgSuccessRate * 10) / 10,
    avgAttemptsPerSession: Math.round(avgAttempts * 10) / 10,
    avgRoutesPerSession: Math.round(avgRoutes * 10) / 10,
    avgDurationHours: Math.round(avgDuration * 10) / 10,
    typicalSuccessRateRange,
    sessionCount: sortedSessions.length,
    sessionMetrics, // Keep for anomaly detection
  };
}

/**
 * Calculate standard deviation
 */
calculateStdDev(values) {
  if (values.length === 0) return 0;
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squareDiffs = values.map(v => Math.pow(v - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.sqrt(avgSquareDiff);
}

/**
 * Detect performance anomalies in a session
 */
detectPerformanceAnomaly(session, baseline) {
  if (!baseline || !session) return null;

  // REUSE: Use existing calculateSessionStatistics()
  const stats = this.calculateSessionStatistics(session.attempts || []);
  
  const sessionDate = new Date(session.startTime);
  const endDate = session.endTime ? new Date(session.endTime) : sessionDate;
  const durationHours = (endDate - sessionDate) / (1000 * 60 * 60);

  const currentSuccessRate = stats.totalRoutes > 0 
    ? (stats.successfulRoutes / stats.totalRoutes) * 100 
    : 0;
  const currentAttempts = stats.totalAttempts;
  const currentRoutes = stats.totalRoutes;

  // Check for performance drop
  const successRateDrop = baseline.avgSuccessRate - currentSuccessRate;
  const isSignificantDrop = successRateDrop > 30; // 30% threshold

  // Check if below typical range
  const belowTypicalRange = currentSuccessRate < baseline.typicalSuccessRateRange.min;

  // Calculate consecutive days
  const consecutiveDays = this.calculateConsecutiveDays(sessionDate, baseline.sessionMetrics);

  // Calculate recent volume (last 3-5 days)
  const recentVolume = this.calculateRecentVolume(sessionDate, baseline.sessionMetrics, 5);

  // Determine if anomaly
  if (isSignificantDrop || belowTypicalRange) {
    const severity = successRateDrop > 40 ? 'high' : successRateDrop > 30 ? 'moderate' : 'low';
    
    return {
      isAnomaly: true,
      severity,
      metrics: {
        currentSuccessRate: Math.round(currentSuccessRate * 10) / 10,
        baselineSuccessRate: baseline.avgSuccessRate,
        successRateDrop: Math.round(successRateDrop * 10) / 10,
        currentAttempts,
        baselineAttempts: baseline.avgAttemptsPerSession,
        consecutiveDays,
        recentVolume,
      },
      insight: this.generateInsightMessage({
        successRateDrop,
        consecutiveDays,
        recentVolume,
        baseline,
        severity,
      }),
    };
  }

  return null;
}

/**
 * Calculate consecutive climbing days
 */
calculateConsecutiveDays(sessionDate, sessionMetrics) {
  // Sort by date descending
  const sorted = [...sessionMetrics].sort((a, b) => b.date - a.date);
  
  let consecutive = 0;
  let currentDate = new Date(sessionDate);
  currentDate.setHours(0, 0, 0, 0);

  for (const metric of sorted) {
    const metricDate = new Date(metric.date);
    metricDate.setHours(0, 0, 0, 0);
    
    const daysDiff = (currentDate - metricDate) / (1000 * 60 * 60 * 24);
    
    if (daysDiff === consecutive) {
      consecutive++;
      currentDate = metricDate;
    } else if (daysDiff > consecutive) {
      break;
    }
  }

  return consecutive;
}

/**
 * Calculate recent volume (attempts in last N days)
 */
calculateRecentVolume(sessionDate, sessionMetrics, days = 5) {
  const cutoffDate = new Date(sessionDate);
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return sessionMetrics
    .filter(m => {
      const metricDate = new Date(m.date);
      return metricDate >= cutoffDate && metricDate <= sessionDate;
    })
    .reduce((sum, m) => sum + m.totalAttempts, 0);
}

/**
 * Generate insight message
 */
generateInsightMessage({ successRateDrop, consecutiveDays, recentVolume, baseline, severity }) {
  const messages = [];

  if (successRateDrop > 30) {
    messages.push(
      `Your session today had a ${Math.round(successRateDrop)}% lower success rate than your average ` +
      `(${Math.round(baseline.avgSuccessRate - successRateDrop)}% vs ${baseline.avgSuccessRate}%).`
    );
  }

  if (consecutiveDays > baseline.avgDaysPerWeek * 1.5) {
    messages.push(
      `You've climbed ${consecutiveDays} consecutive days, which is more than your usual ` +
      `${baseline.avgDaysPerWeek.toFixed(1)} days/week pattern.`
    );
  }

  if (recentVolume > baseline.avgAttemptsPerSession * 3) {
    messages.push(
      `Your recent volume (${recentVolume} attempts in the last 5 days) is significantly higher than your average.`
    );
  }

  if (messages.length > 0) {
    messages.push("This might indicate fatigue. Consider resting to recover.");
  }

  return messages.join(" ");
}

/**
 * Calculate rest day insights for a user
 */
async calculateRestDayInsights(userId, options = {}) {
  const { minSessions = 10 } = options;

  // Get all completed sessions
  const sessions = await prisma.climbingSession.findMany({
    where: {
      userId,
      endTime: { not: null },
    },
    include: {
      attempts: true,
    },
    orderBy: {
      startTime: 'asc',
    },
  });

  if (sessions.length < minSessions) {
    return {
      hasEnoughData: false,
      sessionCount: sessions.length,
      minSessionsRequired: minSessions,
      baseline: null,
      currentInsight: null,
    };
  }

  // Calculate baseline
  const baseline = this.calculateUserBaseline(sessions);

  if (!baseline) {
    return {
      hasEnoughData: false,
      sessionCount: sessions.length,
      minSessionsRequired: minSessions,
      baseline: null,
      currentInsight: null,
    };
  }

  // Get most recent session for anomaly detection
  const mostRecentSession = sessions[sessions.length - 1];
  const currentInsight = this.detectPerformanceAnomaly(mostRecentSession, baseline);

  return {
    hasEnoughData: true,
    sessionCount: sessions.length,
    baseline: {
      avgDaysPerWeek: baseline.avgDaysPerWeek,
      avgSuccessRate: baseline.avgSuccessRate,
      avgAttemptsPerSession: baseline.avgAttemptsPerSession,
      avgRoutesPerSession: baseline.avgRoutesPerSession,
      typicalSuccessRateRange: baseline.typicalSuccessRateRange,
    },
    currentInsight: currentInsight ? {
      severity: currentInsight.severity,
      message: currentInsight.insight,
      metrics: currentInsight.metrics,
    } : null,
  };
}
```

### Step 2: Add Controller Endpoint

Add to `backend/controllers/sessionController.js`:

```javascript
export const getRestDayInsightsController = async (req, res) => {
  const requestId = Date.now().toString();
  try {
    const userId = req.user?.userId;
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return res.status(401).json({ error: "Unauthorized" });
    }

    logger.info({ requestId, userId }, "Getting rest day insights");

    const minSessions = req.query.minSessions 
      ? parseInt(req.query.minSessions, 10) 
      : 10;

    const insights = await sessionService.calculateRestDayInsights(userId, {
      minSessions: Math.max(minSessions, 10),
    });

    logger.info({ 
      requestId, 
      hasEnoughData: insights.hasEnoughData,
      hasInsight: !!insights.currentInsight,
    }, "Rest day insights calculated");

    res.status(200).json(insights);
  } catch (error) {
    logger.error(
      {
        requestId,
        userId: req.user?.userId,
        error: error.message,
        stack: error.stack,
      },
      "Failed to get rest day insights"
    );
    res.status(500).json({ error: "Failed to get rest day insights" });
  }
};
```

### Step 3: Update Session Deletion

Modify `backend/services/sessionService.js` - `deleteSession` method:

```javascript
async deleteSession(sessionId, userId) {
  const session = await prisma.climbingSession.findFirst({
    where: {
      id: sessionId,
      userId,
    },
    include: { attempts: true },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  // Delete the session
  await this.delete({ id: sessionId });

  // Recalculate baseline after deletion (background, don't block)
  recalculateBaselineAfterDeletion(userId).catch(err => {
    logger.error({ userId, sessionId, error: err }, "Failed to recalculate baseline after deletion");
  });

  return { success: true };
}
```

Modify `backend/controllers/sessionController.js` - `deleteSessionController`:

```javascript
export const deleteSessionController = async (req, res) => {
  // ... existing code ...
  
  await sessionService.deleteSession(sessionId, userId);
  
  // Baseline recalculation happens in service (background)
  
  res.status(204).send();
};
```

### Step 4: Add Route

```javascript
import { 
  // ... existing imports
  getRestDayInsightsController,
} from '../controllers/sessionController.js';

// ... existing routes
router.get('/rest-insights', getRestDayInsightsController);
```

### Step 4: Integrate with Existing Insights

Option A: Add to existing `/sessions/overview` endpoint:

Modify `getInsightsAndProgressionController` to include rest day insights:

```javascript
export const getInsightsAndProgressionController = async (req, res) => {
  // ... existing code ...
  
  const [insights, progression, restInsights] = await Promise.all([
    sessionService.calculateInsights(userId, {...}),
    sessionService.calculateGradeProgression(userId, {...}),
    sessionService.calculateRestDayInsights(userId, { minSessions: 10 }),
  ]);

  res.status(200).json({
    insights,
    progression,
    restInsights, // Add this
  });
};
```

Option B: Keep separate endpoint (simpler, can be called independently)

### Step 5: User Preference Toggle

**Important**: This toggle only controls **alerts** (push notifications), NOT insights. Insights are always displayed in ProfileScreen.

Add to `mobile/src/screens/ProfileScreen.js`:

```javascript
const [restDayAlertsEnabled, setRestDayAlertsEnabled] = useState(true);

// Fetch user preference
useEffect(() => {
  if (user?.restDayAlertsEnabled !== undefined) {
    setRestDayAlertsEnabled(user.restDayAlertsEnabled);
  }
}, [user]);

// Toggle preference
const toggleRestDayAlerts = async (value) => {
  try {
    setRestDayAlertsEnabled(value);
    await api.patch('/auth/profile', { restDayAlertsEnabled: value });
    showSuccessAlert(value ? 'Rest day alerts enabled' : 'Rest day alerts disabled');
  } catch (error) {
    setRestDayAlertsEnabled(!value); // Revert on error
    showError(error, 'Failed to update preference');
  }
};

// In render:
<Section>
  <Text style={styles.preferenceLabel}>Rest Day Alerts</Text>
  <View style={styles.toggleContainer}>
    <Text style={styles.toggleDescription}>
      Receive push notifications when your performance suggests you might benefit from rest.
      Insights will still be shown below regardless of this setting.
    </Text>
    <Switch
      value={restDayAlertsEnabled}
      onValueChange={toggleRestDayAlerts}
    />
  </View>
</Section>
```

### Step 6: Frontend Integration - Display Insights

Add to `mobile/src/screens/ProfileScreen.js`:

```javascript
const [restInsights, setRestInsights] = useState(null);

// In fetchInsights or separate function
const fetchRestInsights = async () => {
  try {
    const response = await api.get('/sessions/rest-insights');
    setRestInsights(response.data);
  } catch (error) {
    console.error("Failed to fetch rest insights:", error);
  }
};

// Render function
const renderRestDayInsights = () => {
  if (!restInsights) return null;
  
  if (!restInsights.hasEnoughData) {
    return (
      <Section>
        <Text style={styles.insightsTitle}>💤 Rest Day Insights</Text>
        <Text style={styles.progressText}>
          Log {restInsights.minSessionsRequired} sessions to unlock rest day insights
        </Text>
        <Text style={styles.progressLabel}>
          Progress: {restInsights.sessionCount}/{restInsights.minSessionsRequired} sessions
        </Text>
      </Section>
    );
  }

  if (!restInsights.currentInsight) {
    return null; // No insight to show
  }

  const severityColor = {
    high: '#F44336',
    moderate: '#FF9800',
    low: '#FFC107',
  }[restInsights.currentInsight.severity] || '#666';

  return (
    <Section>
      <Text style={styles.insightsTitle}>💤 Rest Day Insights</Text>
      <View style={[styles.restInsightCard, { borderLeftColor: severityColor }]}>
        <Text style={styles.restInsightMessage}>
          {restInsights.currentInsight.message}
        </Text>
        {restInsights.currentInsight.metrics && (
          <View style={styles.restInsightMetrics}>
            <Text style={styles.restInsightMetric}>
              Success Rate: {restInsights.currentInsight.metrics.currentSuccessRate}% 
              (avg: {restInsights.baseline.avgSuccessRate}%)
            </Text>
            <Text style={styles.restInsightMetric}>
              Consecutive Days: {restInsights.currentInsight.metrics.consecutiveDays}
            </Text>
          </View>
        )}
      </View>
    </Section>
  );
};
```

## Important Edge Cases

### 1. Auto-Discard Sessions with No Attempts

Sessions with zero attempts are clearly mistakes (user started session but forgot to log anything).

**Implementation**: Check immediately when session is ended/synced, NOT in background:
- **0 attempts → auto delete immediately**
- No questions, no faff, just delete it
- **CRITICAL**: Don't even save to local storage - check before saving

**Handle in**:

1. **Frontend: Disable "End Session" button in LayoutDetailScreen.js** - Prevent ending session with no routes:
```javascript
// In render, where End Session button is:
<Pressable
  style={[
    styles.filterButton,
    activeLocalSession && styles.endSessionButton,
    activeLocalSession && sessionRoutes.length === 0 && styles.disabledButton
  ]}
  onPress={activeLocalSession ? endSession : startSession}
  disabled={activeLocalSession && sessionRoutes.length === 0}
>
  <Text style={[
    styles.filterButtonText,
    activeLocalSession && styles.endSessionButtonText,
    activeLocalSession && sessionRoutes.length === 0 && styles.disabledButtonText
  ]}>
    {activeLocalSession 
      ? (sessionRoutes.length === 0 ? '⏹️ End Session (log a route first)' : '⏹️ End Session')
      : '▶️ Start Session'}
  </Text>
</Pressable>
```

**Result**: User cannot end session if no routes logged - button is disabled and shows helpful message.

2. **Frontend: `handleSaveSession` in LayoutDetailScreen.js** - Safety check (shouldn't be needed):
```javascript
const handleSaveSession = async () => {
  if (!activeLocalSession) return;

  // Safety check (button should be disabled, but just in case)
  if (editingRoutes.length === 0) {
    setShowReviewModal(false);
    showErrorAlert('Cannot save session with no routes. Please log at least one route.');
    return;
  }

  // Continue with normal save flow...
  const endTime = new Date().toISOString();
  const updatedSession = {
    ...activeLocalSession,
    endTime,
    notes: sessionNotes.trim() || null,
    routes: updatedRoutes,
    status: 'completed',
  };

  await saveLocalSession(updatedSession);
  // ... rest of save logic
};
```

2. **Frontend: `syncLocalSessions` in sessionSync.js** - Filter before syncing:
```javascript
export async function syncLocalSessions(api, options = {}) {
  const pendingSessions = providedSessions ?? await getPendingSyncSessions();
  
  // Filter out empty sessions (auto-discard)
  const validSessions = pendingSessions.filter(session => 
    session.routes && session.routes.length > 0
  );
  
  // Delete empty sessions from local storage
  const emptySessions = pendingSessions.filter(session => 
    !session.routes || session.routes.length === 0
  );
  
  for (const emptySession of emptySessions) {
    await deleteLocalSession(emptySession.id);
  }
  
  if (validSessions.length === 0) {
    return { synced: 0, failed: 0, syncedIds: [], failedIds: [] };
  }
  
  // Continue with sync using only valid sessions...
}
```

3. **Backend: `endSessionController`** - Before saving endTime (safety check):
```javascript
export const endSessionController = async (req, res) => {
  // ... existing code ...
  
  const session = await sessionService.getOne({ id: sessionId });
  
  // Safety check: If session has no attempts, delete it
  // (Should rarely happen since frontend filters, but good safety net)
  const attempts = await prisma.sessionRoute.findMany({
    where: { sessionId },
  });
  
  if (attempts.length === 0) {
    await sessionService.deleteSession(sessionId, userId);
    logger.info({ userId, sessionId }, "Auto-deleted empty session");
    return res.status(200).json({ 
      message: "Session discarded - no routes logged",
      deleted: true 
    });
  }
  
  // Continue with normal end session flow...
};
```

2. **`syncOfflineSessionController`** - Before creating session:
```javascript
export const syncOfflineSessionController = async (req, res) => {
  // ... validation ...
  
  // Check if routes array is empty
  if (!validatedData.routes || validatedData.routes.length === 0) {
    logger.info({ userId }, "Rejected sync - no routes in session");
    return res.status(200).json({ 
      message: "Session discarded - no routes logged",
      discarded: true 
    });
  }
  
  // Continue with sync...
};
```

3. **`syncOfflineSessionsBulkController`** - Filter out empty sessions:
```javascript
export const syncOfflineSessionsBulkController = async (req, res) => {
  // Filter out sessions with no routes (shouldn't happen if frontend filters, but safety check)
  const validSessions = validatedData.filter(session => 
    session.routes && session.routes.length > 0
  );
  
  const discardedCount = validatedData.length - validSessions.length;
  if (discardedCount > 0) {
    logger.info({ userId, discardedCount }, "Discarded empty sessions from bulk sync");
  }
  
  // Process only valid sessions...
};
```

**Priority Order**:
1. **Frontend `handleSaveSession`** - Primary check, prevents saving to local storage ✅
2. **Frontend `syncLocalSessions`** - Secondary check, filters before sync ✅
3. **Backend endpoints** - Safety net, should rarely be needed

### 2. Session Deletion - Recalculate Baseline

When user deletes a session, baseline must be recalculated because:
- Baseline is based on all sessions
- Deleted session was part of baseline calculation
- Baseline metrics will change

**Implementation**: See Step 3 above - hook into `deleteSession` method.

### 3. Push Notifications Setup

Since we're using push notifications as gateway:
- Set up push notification infrastructure (Expo Push Notifications or similar)
- Store device tokens in User model or separate DeviceToken table
- Send push when anomaly detected and alerts enabled
- Handle notification permissions

## Testing Strategy

1. **Unit Tests**: Test baseline calculation with mock sessions
2. **Anomaly Detection**: Test with sessions that have performance drops
3. **Edge Cases**: 
   - Less than 10 sessions
   - All sessions same performance
   - Extreme variations
   - Sessions with no attempts (should be auto-deleted)
   - Session deletion (baseline should recalculate)
4. **Integration**: Test with real user data
5. **Push Notifications**: Test alert delivery when anomaly detected

## Performance Considerations

- Cache baseline calculation (recalculate only when new session added)
- Use database indexes on `startTime` for date queries
- Consider pagination if user has many sessions

## Next Steps

1. Implement baseline calculation
2. Implement anomaly detection
3. Add controller and route
4. Test with sample data
5. Add frontend UI
6. Monitor and refine thresholds

## Future: Recovery Tracking

To track recovery after rest days, you'd need to:

1. **Identify rest periods**: Days with no sessions
2. **Track post-rest sessions**: Sessions after rest days
3. **Compare performance**: Before rest vs after rest
4. **Classify recovery pattern**: Immediate vs gradual

This would be a Phase 2 enhancement after basic anomaly detection is working.
