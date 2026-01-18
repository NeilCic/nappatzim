import PrismaCrudService from "./prismaCrudService.js";
import prisma from "../lib/prisma.js";
import { calculateAverageGrade, gradeToNumber, numberToGrade } from "../lib/gradeUtils.js";
import climbService from "./climbService.js";

function calculateVoterGradeAndDescriptors(votes, gradeSystem) {
  let voterGrade = null;
  let descriptors = [];

  if (votes && votes.length > 0) {
    const grades = votes.map((v) => v.grade).filter(Boolean);
    voterGrade = calculateAverageGrade(grades, gradeSystem);

    const descriptorSet = new Set();
    votes.forEach((vote) => {
      if (Array.isArray(vote.descriptors)) {
        vote.descriptors.forEach((d) => {
          if (d) {
            descriptorSet.add(d.trim().toLowerCase());
          }
        });
      }
    });
    descriptors = Array.from(descriptorSet);
  }

  return { voterGrade, descriptors };
}

function calculateSessionStatistics(attempts) {
  if (!attempts || attempts.length === 0) {
    return {
      totalRoutes: 0,
      successfulRoutes: 0,
      failedRoutes: 0,
      totalAttempts: 0,
      averageProposedGrade: null,
      averageVoterGrade: null,
    };
  }

  const successfulRoutes = attempts.filter((a) => a.status === "success").length;
  const failedRoutes = attempts.filter((a) => a.status === "failure").length;
  const totalAttempts = attempts.reduce((sum, a) => sum + a.attempts, 0);

  // Calculate average grades (assuming single grade system per session)
  const gradeSystem = attempts[0]?.gradeSystem || null;
  const proposedGrades = attempts.map((a) => a.proposedGrade).filter(Boolean);
  const voterGrades = attempts.map((a) => a.voterGrade).filter(Boolean);

  return {
    totalRoutes: attempts.length,
    successfulRoutes,
    failedRoutes,
    totalAttempts,
    averageProposedGrade: proposedGrades.length > 0 && gradeSystem 
      ? calculateAverageGrade(proposedGrades, gradeSystem) 
      : null,
    averageVoterGrade: voterGrades.length > 0 && gradeSystem 
      ? calculateAverageGrade(voterGrades, gradeSystem) 
      : null,
  };
}

class SessionService extends PrismaCrudService {
  constructor() {
    super("ClimbingSession", {}, { createdAt: "desc" });
  }

  async createSession(userId, startTime) {
    return await this.create({
      userId,
      startTime,
    });
  }

  async endSession(sessionId, endTime, notes = null) {
    return await this.update({ id: sessionId }, {
      endTime,
      ...(notes !== null ? { notes } : {}),
    });
  }

  async addRoute(sessionId, climbId, isSuccess, attempts) {
    let proposedGrade = null;
    let gradeSystem = null;
    let voterGrade = null;
    let descriptors = [];

    if (climbId) {
      const existing = await prisma.sessionRoute.findFirst({
        where: {
          sessionId,
          climbId,
        },
      });

      if (existing) {
        throw new Error("Route already logged in this session");
      }

      const climb = await climbService.getOne(
        { id: climbId },
        undefined,
        {
          grade: true,
          gradeSystem: true,
          votes: {
            select: {
              grade: true,
              gradeSystem: true,
              descriptors: true,
            },
          },
        }
      );

      if (climb) {
        proposedGrade = climb.grade;
        gradeSystem = climb.gradeSystem;

        const result = calculateVoterGradeAndDescriptors(climb.votes, gradeSystem);
        voterGrade = result.voterGrade;
        descriptors = result.descriptors;
      }
    }

    return await prisma.sessionRoute.create({
      data: {
        sessionId,
        climbId,
        proposedGrade: proposedGrade || "Unknown",
        gradeSystem: gradeSystem || "V-Scale",
        voterGrade,
        descriptors,
        status: isSuccess ? "success" : "failure",
        attempts,
      },
    });
  }

  async getSessionsByUser(userId, options = {}) {
    const { 
      limit = 20, 
      cursor, 
      includeStatistics = false, 
      startDate, 
      endDate, 
      minDuration, 
      maxDuration,
      minAvgProposedGrade,
      maxAvgProposedGrade,
      minAvgVoterGrade,
      maxAvgVoterGrade,
    } = options;

    const where = { userId };

    if (cursor) {
      where.createdAt = { lt: new Date(cursor) };
    }

    if (startDate) {
      where.startTime = { ...where.startTime, gte: new Date(startDate) };
    }

    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      where.startTime = { ...where.startTime, lte: endDateTime };
    }

    const sessions = await prisma.climbingSession.findMany({
      where,
      include: {
        attempts: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });

    // Filter by duration if specified (duration = endTime - startTime in minutes)
    let filteredSessions = sessions;
    if (minDuration !== undefined || maxDuration !== undefined) {
      filteredSessions = sessions.filter((session) => {
        if (!session.endTime) return false; // Exclude ongoing sessions
        
        const durationMs = new Date(session.endTime) - new Date(session.startTime);
        const durationMins = Math.floor(durationMs / (1000 * 60));

        if (minDuration !== undefined && durationMins < minDuration) return false;
        if (maxDuration !== undefined && durationMins > maxDuration) return false;
        return true;
      });
    }

    let hasMore = filteredSessions.length > limit;
    const results = hasMore ? filteredSessions.slice(0, limit) : filteredSessions;
    let nextCursor = hasMore ? results[results.length - 1].createdAt.toISOString() : null;

    let sessionsToReturn = results;
    if (includeStatistics) {
      sessionsToReturn = results.map((session) => ({
        ...session,
        statistics: calculateSessionStatistics(session.attempts || []),
      }));
    }

    // Filter by average grades if specified
    const hasGradeFilters = minAvgProposedGrade !== undefined || maxAvgProposedGrade !== undefined || 
                            minAvgVoterGrade !== undefined || maxAvgVoterGrade !== undefined;
    
    if (hasGradeFilters && includeStatistics) {
      sessionsToReturn = sessionsToReturn.filter((session) => {
        const stats = session.statistics || {};
        const gradeSystem = session.attempts?.[0]?.gradeSystem || null;
        
        if (!gradeSystem) return false; // Can't filter if no grade system

        // Filter by proposed grade
        if (minAvgProposedGrade !== undefined || maxAvgProposedGrade !== undefined) {
          const avgProposedGrade = stats.averageProposedGrade;
          if (!avgProposedGrade) return false;

          const proposedNumeric = gradeToNumber(avgProposedGrade, gradeSystem);
          const minProposedNumeric = minAvgProposedGrade !== undefined ? gradeToNumber(minAvgProposedGrade, gradeSystem) : null;
          const maxProposedNumeric = maxAvgProposedGrade !== undefined ? gradeToNumber(maxAvgProposedGrade, gradeSystem) : null;

          if (proposedNumeric === null) return false;
          if (minProposedNumeric !== null && proposedNumeric < minProposedNumeric) return false;
          if (maxProposedNumeric !== null && proposedNumeric > maxProposedNumeric) return false;
        }

        // Filter by voter grade
        if (minAvgVoterGrade !== undefined || maxAvgVoterGrade !== undefined) {
          const avgVoterGrade = stats.averageVoterGrade;
          if (!avgVoterGrade) return false;

          const voterNumeric = gradeToNumber(avgVoterGrade, gradeSystem);
          const minVoterNumeric = minAvgVoterGrade !== undefined ? gradeToNumber(minAvgVoterGrade, gradeSystem) : null;
          const maxVoterNumeric = maxAvgVoterGrade !== undefined ? gradeToNumber(maxAvgVoterGrade, gradeSystem) : null;

          if (voterNumeric === null) return false;
          if (minVoterNumeric !== null && voterNumeric < minVoterNumeric) return false;
          if (maxVoterNumeric !== null && voterNumeric > maxVoterNumeric) return false;
        }

        return true;
      });

      // Recalculate pagination after grade filtering
      const hasMoreAfterGradeFilter = sessionsToReturn.length > limit;
      sessionsToReturn = hasMoreAfterGradeFilter ? sessionsToReturn.slice(0, limit) : sessionsToReturn;
      nextCursor = hasMoreAfterGradeFilter ? sessionsToReturn[sessionsToReturn.length - 1].createdAt.toISOString() : null;
      hasMore = hasMoreAfterGradeFilter;
    }

    return {
      sessions: sessionsToReturn,
      nextCursor,
      hasMore,
    };
  }

  async getSessionById(sessionId, userId, options = {}) {
    const { includeStatistics = true } = options;
    
    const session = await prisma.climbingSession.findFirst({
      where: {
        id: sessionId,
        userId, // Ensure user owns the session
      },
      include: {
        attempts: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session) {
      return null;
    }

    if (includeStatistics) {
      return {
        ...session,
        statistics: calculateSessionStatistics(session.attempts || []),
      };
    }

    return session;
  }

  async updateAttemptsOnClimbDeletion(climbId, climbData) {
    if (!climbData) {
      return;
    }

    let voterGrade = null;
    let descriptors = [];

    const result = calculateVoterGradeAndDescriptors(climbData.votes, climbData.gradeSystem);
    voterGrade = result.voterGrade;
    descriptors = result.descriptors;

    // Update all session routes that reference this climb
    await prisma.sessionRoute.updateMany({
      where: { climbId },
      data: {
        proposedGrade: climbData.grade,
        gradeSystem: climbData.gradeSystem,
        voterGrade,
        descriptors,
        climbId: null,
      },
    });
  }

  async updateRoute(routeId, userId, data) {
    const sessionRoute = await prisma.sessionRoute.findFirst({
      where: {
        id: routeId,
        session: {
          userId, // Ensure user owns the session
        },
      },
    });

    if (!sessionRoute) {
      throw new Error("Route not found");
    }

    const updateData = {};
    if (data.isSuccess !== undefined) {
      updateData.status = data.isSuccess ? "success" : "failure";
    }
    if (data.attempts !== undefined) {
      updateData.attempts = data.attempts;
    }

    return await prisma.sessionRoute.update({
      where: { id: routeId },
      data: updateData,
    });
  }

  async updateRouteMetadata(routeId, userId) {
    const sessionRoute = await prisma.sessionRoute.findFirst({
      where: {
        id: routeId,
        session: {
          userId, // Ensure user owns the session
        },
      },
    });

    if (!sessionRoute || !sessionRoute.climbId) {
      throw new Error("Route not found or climb no longer exists");
    }

    const climb = await climbService.getOne(
      { id: sessionRoute.climbId },
      undefined,
      {
        grade: true,
        gradeSystem: true,
        votes: {
          select: {
            grade: true,
            gradeSystem: true,
            descriptors: true,
          },
        },
      }
    );

    if (!climb) {
      throw new Error("Climb no longer exists");
    }

    const { voterGrade, descriptors } = calculateVoterGradeAndDescriptors(climb.votes, climb.gradeSystem);

    return await prisma.sessionRoute.update({
      where: { id: routeId },
      data: {
        proposedGrade: climb.grade,
        gradeSystem: climb.gradeSystem,
        voterGrade,
        descriptors,
      },
    });
  }

  async getLoggedClimbIds(userId) {
    const routes = await prisma.sessionRoute.findMany({
      where: {
        session: {
          userId,
        },
        climbId: {
          not: null,
        },
      },
      select: {
        climbId: true,
      },
      distinct: ['climbId'],
    });

    return routes.map(route => route.climbId).filter(Boolean);
  }

  async deleteSession(sessionId, userId) {
    const session = await prisma.climbingSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!session) {
      throw new Error("Session not found");
    }

    return await this.delete({ id: sessionId });
  }

  async calculateGradeProfile(userId, options = {}) {
    const { minSessions = 5 } = options;

    // Get all completed sessions (with endTime) for the user
    const sessions = await prisma.climbingSession.findMany({
      where: {
        userId,
        endTime: { not: null }, // Only completed sessions
      },
      include: {
        attempts: true,
      },
    });

    // Check minimum session requirement
    if (sessions.length < minSessions) {
      return {
        hasEnoughData: false,
        sessionCount: sessions.length,
        minSessionsRequired: minSessions,
        gradeProfile: null,
      };
    }

    // Collect all routes from all sessions
    const allRoutes = [];
    sessions.forEach(session => {
      if (session.attempts && session.attempts.length > 0) {
        allRoutes.push(...session.attempts);
      }
    });

    if (allRoutes.length === 0) {
      return {
        hasEnoughData: false,
        sessionCount: sessions.length,
        minSessionsRequired: minSessions,
        gradeProfile: null,
      };
    }

    // Group routes by grade (prefer voterGrade, fallback to proposedGrade)
    // Also track grade system (assuming single system per user for now)
    const gradeMap = new Map();
    let primaryGradeSystem = null;

    allRoutes.forEach(route => {
      const grade = route.voterGrade || route.proposedGrade;
      const gradeSystem = route.gradeSystem || 'V-Scale';

      if (!grade || grade === 'Unknown') return;

      // Track primary grade system (use first one encountered, assuming single system per user)
      if (!primaryGradeSystem) {
        primaryGradeSystem = gradeSystem;
      }

      if (!gradeMap.has(grade)) {
        gradeMap.set(grade, {
          grade,
          gradeSystem,
          totalAttempts: 0,
          successfulAttempts: 0,
          totalRoutes: 0,
          successfulRoutes: 0,
        });
      }

      const gradeStats = gradeMap.get(grade);
      gradeStats.totalAttempts += route.attempts;
      gradeStats.totalRoutes += 1;
      
      if (route.status === 'success') {
        gradeStats.successfulAttempts += route.attempts;
        gradeStats.successfulRoutes += 1;
      }
    });

    // Convert to array and calculate success rates
    const gradeStatsArray = Array.from(gradeMap.values())
      .map(stats => ({
        ...stats,
        successRateRoutes: stats.totalRoutes > 0 ? (stats.successfulRoutes / stats.totalRoutes) * 100 : 0,
        successRateAttempts: stats.totalAttempts > 0 ? (stats.successfulAttempts / stats.totalAttempts) * 100 : 0,
        numericValue: gradeToNumber(stats.grade, stats.gradeSystem),
      }))
      .filter(stats => stats.numericValue !== null)
      .sort((a, b) => a.numericValue - b.numericValue);

    if (gradeStatsArray.length === 0) {
      return {
        hasEnoughData: false,
        sessionCount: sessions.length,
        minSessionsRequired: minSessions,
        gradeProfile: null,
      };
    }

    // Calculate zones based on success rate (using route success rate, not attempt rate)
    // Logic:
    // - Comfort Zone: High success rate (>= 70%) - grades you consistently send, confidence zone
    //   These are grades where you send most routes, indicating they're well within your ability
    // - Project Zone: Medium success rate (30-50%) - grades you're working on, challenging but achievable
    //   These are grades where you're putting in effort and seeing some success, indicating they're at your limit
    // - Too Hard: Very low success rate (< 20%) - grades that are currently too difficult
    //   These are grades where you rarely send routes, indicating they're above your current ability
    // Using route success rate (% of routes sent) rather than attempt success rate (% of attempts that succeeded)
    // because route success better reflects consistency (did you send it or not) vs total attempts spent
    
    const COMFORT_ZONE_THRESHOLD = 70; // >= 70% route success rate
    const PROJECT_ZONE_MIN = 30; // >= 30% route success rate (lower bound)
    const PROJECT_ZONE_MAX = 50; // < 50% route success rate (upper bound)
    const TOO_HARD_THRESHOLD = 20; // < 20% route success rate
    
    const comfortZone = gradeStatsArray.filter(stats => stats.successRateRoutes >= COMFORT_ZONE_THRESHOLD);
    const projectZone = gradeStatsArray.filter(stats => 
      stats.successRateRoutes >= PROJECT_ZONE_MIN && stats.successRateRoutes < PROJECT_ZONE_MAX
    );
    const tooHard = gradeStatsArray.filter(stats => stats.successRateRoutes < TOO_HARD_THRESHOLD);

    // Find ideal progression grade (next grade up from highest comfort zone grade)
    // Simply calculate next grade: if highest comfort is V5 (numericValue=5), progression is V6 (numericValue=6)
    // No need to search - just increment numeric value and convert back to grade string
    // This is just a grade suggestion - actual route matching happens in route suggestions feature
    let idealProgressionGrade = null;
    if (comfortZone.length > 0 && primaryGradeSystem) {
      const highestComfortGrade = comfortZone[comfortZone.length - 1];
      const nextGradeNumeric = highestComfortGrade.numericValue + 1;
      const nextGradeString = numberToGrade(nextGradeNumeric, primaryGradeSystem);
      
      if (nextGradeString) {
        idealProgressionGrade = nextGradeString; // Just the grade string, e.g. "V6"
      }
    }

    return {
      hasEnoughData: true,
      sessionCount: sessions.length,
      totalRoutes: allRoutes.length,
      gradeSystem: primaryGradeSystem,
      gradeProfile: {
        byGrade: gradeStatsArray,
        comfortZone: comfortZone.map(s => ({
          grade: s.grade,
          successRate: Math.round(s.successRateRoutes),
          totalRoutes: s.totalRoutes,
        })),
        projectZone: projectZone.map(s => ({
          grade: s.grade,
          successRate: Math.round(s.successRateRoutes),
          totalRoutes: s.totalRoutes,
        })),
        tooHard: tooHard.map(s => ({
          grade: s.grade,
          successRate: Math.round(s.successRateRoutes),
          totalRoutes: s.totalRoutes,
        })),
        idealProgressionGrade: idealProgressionGrade, // Just the grade string, e.g. "V6"
      },
    };
  }
}

const sessionService = new SessionService();

export default sessionService;
