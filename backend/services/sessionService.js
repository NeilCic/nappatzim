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

  async calculateInsights(userId, options = {}) {
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
        styleAnalysis: null,
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
        styleAnalysis: null,
      };
    }

    // Group routes by grade (prefer voterGrade, fallback to proposedGrade)
    const gradeMap = new Map();
    const descriptorMap = new Map();
    let primaryGradeSystem = null;

    allRoutes.forEach(route => {
      const isSuccess = route.status === 'success';
      const attempts = route.attempts || 1;

      // Track statistics by grade: count routes and successes per grade
      const grade = route.voterGrade || route.proposedGrade;
      const gradeSystem = route.gradeSystem || 'V-Scale';

      if (grade && grade !== 'Unknown') {
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
        gradeStats.totalAttempts += attempts;
        gradeStats.totalRoutes += 1;
        
        if (isSuccess) {
          gradeStats.successfulAttempts += attempts;
          gradeStats.successfulRoutes += 1;
        }
      }

      // Track statistics by descriptor: count routes and successes per descriptor
      const descriptors = route.descriptors || [];
      descriptors.forEach(descriptor => {
        const normalizedDescriptor = descriptor.trim().toLowerCase();
        
        if (!normalizedDescriptor) return;

        if (!descriptorMap.has(normalizedDescriptor)) {
          descriptorMap.set(normalizedDescriptor, {
            descriptor: normalizedDescriptor,
            totalRoutes: 0,
            successfulRoutes: 0,
            failedRoutes: 0,
            totalAttempts: 0,
          });
        }

        const stats = descriptorMap.get(normalizedDescriptor);
        stats.totalRoutes += 1;
        stats.totalAttempts += attempts;
        
        if (isSuccess) {
          stats.successfulRoutes += 1;
        } else {
          stats.failedRoutes += 1;
        }
      });
    });

    const gradeStatsArray = Array.from(gradeMap.values())
      .map(stats => ({
        ...stats,
        successRateRoutes: stats.totalRoutes > 0 ? (stats.successfulRoutes / stats.totalRoutes) * 100 : 0,
        successRateAttempts: stats.totalAttempts > 0 ? (stats.successfulAttempts / stats.totalAttempts) * 100 : 0,
        numericValue: gradeToNumber(stats.grade, stats.gradeSystem),
      }))
      .filter(stats => stats.numericValue !== null)
      .sort((a, b) => a.numericValue - b.numericValue);

    let gradeProfile = null;
    if (gradeStatsArray.length > 0) {
      const COMFORT_ZONE_THRESHOLD = 70;
      const PROJECT_ZONE_MIN = 30;
      const PROJECT_ZONE_MAX = 50;
      const TOO_HARD_THRESHOLD = 20;
      
      const comfortZone = gradeStatsArray.filter(stats => stats.successRateRoutes >= COMFORT_ZONE_THRESHOLD);
      const projectZone = gradeStatsArray.filter(stats => 
        stats.successRateRoutes >= PROJECT_ZONE_MIN && stats.successRateRoutes < PROJECT_ZONE_MAX
      );
      const tooHard = gradeStatsArray.filter(stats => stats.successRateRoutes < TOO_HARD_THRESHOLD);

      let idealProgressionGrade = null;
      // primaryGradeSystem is guaranteed to be set if gradeStatsArray.length > 0
      if (comfortZone.length > 0) {
        const highestComfortGrade = comfortZone[comfortZone.length - 1];
        const nextGradeNumeric = highestComfortGrade.numericValue + 1;
        idealProgressionGrade = numberToGrade(nextGradeNumeric, primaryGradeSystem);
      }

      gradeProfile = {
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
        idealProgressionGrade: idealProgressionGrade,
      };
    }

    const descriptorStatsArray = Array.from(descriptorMap.values())
      .map(stats => ({
        ...stats,
        successRate: stats.totalRoutes > 0 
          ? (stats.successfulRoutes / stats.totalRoutes) * 100 
          : 0,
      }))
      .filter(stats => stats.totalRoutes > 0);

    let styleAnalysis = null;
    if (descriptorStatsArray.length > 0) {
      const STRENGTH_THRESHOLD = 60;
      const WEAKNESS_THRESHOLD = 40;
      const MIN_ROUTES_FOR_WEAKNESS = 2;

      const strengths = descriptorStatsArray
        .filter(stats => stats.successRate >= STRENGTH_THRESHOLD)
        .map(stats => ({
          descriptor: stats.descriptor,
          successRate: Math.round(stats.successRate),
          totalRoutes: stats.totalRoutes,
          successfulRoutes: stats.successfulRoutes,
          failedRoutes: stats.failedRoutes,
          totalAttempts: stats.totalAttempts,
        }))
        .sort((a, b) => b.successRate - a.successRate);

      const weaknesses = descriptorStatsArray
        .filter(stats => 
          stats.successRate < WEAKNESS_THRESHOLD && stats.totalRoutes >= MIN_ROUTES_FOR_WEAKNESS
        )
        .map(stats => ({
          descriptor: stats.descriptor,
          successRate: Math.round(stats.successRate),
          totalRoutes: stats.totalRoutes,
          successfulRoutes: stats.successfulRoutes,
          failedRoutes: stats.failedRoutes,
          totalAttempts: stats.totalAttempts,
        }))
        .sort((a, b) => a.successRate - b.successRate);

      const preferences = descriptorStatsArray
        .map(stats => ({
          descriptor: stats.descriptor,
          totalRoutes: stats.totalRoutes,
          successfulRoutes: stats.successfulRoutes,
          failedRoutes: stats.failedRoutes,
          totalAttempts: stats.totalAttempts,
          successRate: Math.round(stats.successRate),
        }))
        .sort((a, b) => b.totalRoutes - a.totalRoutes);

      styleAnalysis = {
        strengths,
        weaknesses,
        preferences,
      };
    }

    return {
      hasEnoughData: true,
      sessionCount: sessions.length,
      totalRoutes: allRoutes.length,
      gradeSystem: primaryGradeSystem,
      gradeProfile,
      styleAnalysis,
    };
  }

  // Legacy methods - kept for backward compatibility, now call calculateInsights todo: get rid of these methods
  async calculateGradeProfile(userId, options = {}) {
    const insights = await this.calculateInsights(userId, options);
    return {
      hasEnoughData: insights.hasEnoughData,
      sessionCount: insights.sessionCount,
      minSessionsRequired: insights.minSessionsRequired,
      gradeProfile: insights.gradeProfile,
    };
  }

  async calculateStyleAnalysis(userId, options = {}) {
    const insights = await this.calculateInsights(userId, options);
    return {
      hasEnoughData: insights.hasEnoughData,
      sessionCount: insights.sessionCount,
      minSessionsRequired: insights.minSessionsRequired,
      styleAnalysis: insights.styleAnalysis,
    };
  }
}

const sessionService = new SessionService();

export default sessionService;
