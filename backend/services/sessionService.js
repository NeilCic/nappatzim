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

    try {
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
    } catch (error) {
      // Handle Prisma unique constraint violation (P2002) for duplicate route in session
      if (error.code === 'P2002' && error.meta?.target?.includes('sessionId') && error.meta?.target?.includes('climbId')) {
        const conflictError = new Error("Route already logged in this session");
        conflictError.statusCode = 409;
        throw conflictError;
      }
      throw error;
    }
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

  async calculateInsightsFromSessions(sessions, options = {}) {
    const { minSessions = 5, preferredGradeSystem = null } = options;

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

    const loggedClimbIdsSet = new Set(allRoutes.map(route => route.climbId).filter(Boolean));

    // Group routes by grade (prefer voterGrade, fallback to proposedGrade)
    const gradeMap = new Map();
    const descriptorMap = new Map();
    let primaryGradeSystem = preferredGradeSystem || null;

    allRoutes.forEach(route => {
      const isSuccess = route.status === 'success';
      const attempts = route.attempts || 1;

      // Track statistics by grade: count routes and successes per grade
      const grade = route.voterGrade || route.proposedGrade;
      const gradeSystem = route.gradeSystem || 'V-Scale';

      if (grade && grade !== 'Unknown') {
        // If user has no explicit preference or we haven't locked it in yet,
        // default to the first grade system we actually see in the data.
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
      const CHALLENGING_ZONE_MIN = 50;
      const PROJECT_ZONE_MAX = 50;
      const TOO_HARD_THRESHOLD = 20;
      
      const comfortZone = gradeStatsArray.filter(stats => stats.successRateRoutes >= COMFORT_ZONE_THRESHOLD);
      const challengingZone = gradeStatsArray.filter(stats => 
        stats.successRateRoutes >= CHALLENGING_ZONE_MIN && stats.successRateRoutes < COMFORT_ZONE_THRESHOLD
      );
      const projectZone = gradeStatsArray.filter(stats => 
        stats.successRateRoutes >= TOO_HARD_THRESHOLD && stats.successRateRoutes < PROJECT_ZONE_MAX
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
        challengingZone: challengingZone.map(s => ({
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

    // Calculate route suggestions based on insights
    let routeSuggestions = null;
    if (gradeProfile && styleAnalysis) {
      const { limitPerCategory = 3 } = options;
      
      // Get all climbs with votes (needed to calculate voter grades and descriptors)
      const allClimbs = await prisma.climb.findMany({
        where: {
          id: {
            notIn: Array.from(loggedClimbIdsSet), // Exclude already-logged climbs
          },
        },
        include: {
          votes: {
            select: {
              grade: true,
              gradeSystem: true,
              descriptors: true,
            },
          },
          spot: {
            select: {
              id: true,
              name: true,
              layout: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      // Calculate voter grades and descriptors for each climb
      const climbsWithMetadata = allClimbs.map(climb => {
        const { voterGrade, descriptors } = calculateVoterGradeAndDescriptors(
          climb.votes,
          climb.gradeSystem
        );
        return {
          ...climb,
          voterGrade,
          descriptors: descriptors.map(d => d.toLowerCase()),
        };
      });

      const suggestions = {
        enjoyable: [],
        improve: [],
        progression: [],
      };

      // Helper function to find climbs matching criteria
      const findMatchingClimbs = (targetGrade, targetDescriptors, maxResults = limitPerCategory) => {
        return climbsWithMetadata
          .filter(climb => {
            // Match grade (prefer voter grade, fallback to proposed)
            const climbGrade = climb.voterGrade || climb.grade;
            if (!climbGrade) return false;

            const climbGradeNumeric = gradeToNumber(climbGrade, primaryGradeSystem);
            const targetGradeNumeric = gradeToNumber(targetGrade, primaryGradeSystem);
            
            if (climbGradeNumeric === null || targetGradeNumeric === null) return false;
            if (climbGradeNumeric !== targetGradeNumeric) return false;

            // Match at least one descriptor
            if (!targetDescriptors || targetDescriptors.length === 0) return true;
            
            const climbDescriptorsLower = climb.descriptors || [];
            return targetDescriptors.some(desc => 
              climbDescriptorsLower.includes(desc.toLowerCase())
            );
          })
          .slice(0, maxResults)
          .map(climb => ({
            id: climb.id,
            grade: climb.grade,
            voterGrade: climb.voterGrade,
            descriptors: climb.descriptors,
            spotName: climb.spot?.name,
            layoutId: climb.spot?.layout?.id,
            layoutName: climb.spot?.layout?.name,
          }));
      };

      // 1. Enjoyable: Match strengths at comfort/progression grade
      const strengths = styleAnalysis.strengths.slice(0, 2); // Top 2 strengths
      if (strengths.length > 0 && gradeProfile.comfortZone.length > 0) {
        // Use highest comfort zone grade or progression grade
        const targetGrade = gradeProfile.idealProgressionGrade || 
                           gradeProfile.comfortZone[gradeProfile.comfortZone.length - 1].grade;
        const strengthDescriptors = strengths.map(s => s.descriptor);
        
        suggestions.enjoyable = findMatchingClimbs(targetGrade, strengthDescriptors);
      }

      // 2. Improve: Match weaknesses at slightly easier grade
      const weaknesses = styleAnalysis.weaknesses.slice(0, 2); // Top 2 weaknesses
      if (weaknesses.length > 0 && gradeProfile.comfortZone.length > 0) {
        // Use one grade below lowest comfort zone
        const lowestComfortGrade = gradeProfile.comfortZone[0];
        const lowestComfortNumeric = gradeToNumber(lowestComfortGrade.grade, primaryGradeSystem);
        if (lowestComfortNumeric !== null && lowestComfortNumeric > 0) {
          const improveGradeNumeric = lowestComfortNumeric - 1;
          const improveGrade = numberToGrade(improveGradeNumeric, primaryGradeSystem);
          
          if (improveGrade) {
            const weaknessDescriptors = weaknesses.map(w => w.descriptor);
            suggestions.improve = findMatchingClimbs(improveGrade, weaknessDescriptors);
          }
        }
      }

      // 3. Progression: Slightly harder grade in same style (strengths)
      if (strengths.length > 0 && gradeProfile.idealProgressionGrade) {
        const targetGrade = gradeProfile.idealProgressionGrade;
        const strengthDescriptors = strengths.map(s => s.descriptor);
        
        suggestions.progression = findMatchingClimbs(targetGrade, strengthDescriptors);
      }

      routeSuggestions = suggestions;
    }

    return {
      hasEnoughData: true,
      sessionCount: sessions.length,
      totalRoutes: allRoutes.length,
      gradeSystem: primaryGradeSystem,
      gradeProfile,
      styleAnalysis,
      routeSuggestions,
    };
  }

  async calculateInsights(userId, options = {}) {
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferredGradeSystem: true },
    });

    return this.calculateInsightsFromSessions(sessions, {
      ...options,
      preferredGradeSystem: user?.preferredGradeSystem || null,
    });
  }

  calculateGradeProgressionFromSessions(sessions, preferredGradeSystem = null) {
    if (!sessions || sessions.length === 0) {
      return {
        progression: [],
        gradeSystem: null,
      };
    }

    // Sort by createdAt ascending to build the timeline
    const sortedSessions = [...sessions].sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );

    // Determine primary grade system
    let primaryGradeSystem = null;

    // If user has a preferred system and we have at least one route with that system,
    // respect it. Otherwise, fall back to the first system we encounter.
    if (preferredGradeSystem) {
      outer: for (const session of sortedSessions) {
        for (const attempt of session.attempts || []) {
          if ((attempt.voterGrade || attempt.proposedGrade) && attempt.gradeSystem === preferredGradeSystem) {
            primaryGradeSystem = preferredGradeSystem;
            break outer;
          }
        }
      }
    }

    if (!primaryGradeSystem) {
      for (const session of sortedSessions) {
        const firstRouteWithGrade = session.attempts?.find(
          a => a.voterGrade || a.proposedGrade
        );
        if (firstRouteWithGrade?.gradeSystem) {
          primaryGradeSystem = firstRouteWithGrade.gradeSystem;
          break;
        }
      }
    }

    if (!primaryGradeSystem) {
      return {
        progression: [],
        gradeSystem: null,
      };
    }

    // Calculate progression data for each session
    const progression = sortedSessions.map((session) => {
      const attempts = session.attempts || [];
      
      if (attempts.length === 0) {
      return {
        sessionId: session.id,
        date: session.createdAt.toISOString(),
        averageGradeSent: null,
        averageGradeSentNumeric: null,
        bestGradeSent: null,
        bestGradeSentNumeric: null,
        sendRate: 0,
        totalRoutes: 0,
        successfulRoutes: 0,
      };
      }

      // Filter successful routes only
      const successfulRoutes = attempts.filter(a => a.status === 'success');
      const successfulRoutesWithGrades = successfulRoutes.filter(
        a => a.voterGrade || a.proposedGrade
      );

      // Calculate average grade of successful sends
      let averageGradeSent = null;
      let averageGradeSentNumeric = null;
      if (successfulRoutesWithGrades.length > 0) {
        const successfulGrades = successfulRoutesWithGrades.map(
          a => a.voterGrade || a.proposedGrade
        ).filter(Boolean);
        
        if (successfulGrades.length > 0) {
          averageGradeSent = calculateAverageGrade(successfulGrades, primaryGradeSystem);
          averageGradeSentNumeric = averageGradeSent 
            ? gradeToNumber(averageGradeSent, primaryGradeSystem) 
            : null;
        }
      }

      // Calculate best grade sent
      let bestGradeSent = null;
      let bestGradeSentNumeric = null;
      if (successfulRoutesWithGrades.length > 0) {
        const successfulNumericGrades = successfulRoutesWithGrades
          .map(a => {
            const grade = a.voterGrade || a.proposedGrade;
            return grade ? gradeToNumber(grade, primaryGradeSystem) : null;
          })
          .filter(val => val !== null);

        if (successfulNumericGrades.length > 0) {
          bestGradeSentNumeric = Math.max(...successfulNumericGrades);
          bestGradeSent = numberToGrade(bestGradeSentNumeric, primaryGradeSystem);
        }
      }

      // Calculate send rate
      const totalRoutes = attempts.length;
      const successfulRoutesCount = successfulRoutes.length;
      const sendRate = totalRoutes > 0 
        ? (successfulRoutesCount / totalRoutes) * 100 
        : 0;

      return {
        sessionId: session.id,
        date: session.createdAt.toISOString(),
        averageGradeSent,
        averageGradeSentNumeric,
        bestGradeSent,
        bestGradeSentNumeric,
        sendRate: Math.round(sendRate),
        totalRoutes,
        successfulRoutes: successfulRoutesCount,
      };
    }).filter(session => session.totalRoutes > 0); // Only include sessions with routes

    return {
      progression,
      gradeSystem: primaryGradeSystem,
    };
  }

  async calculateGradeProgression(userId) {
    // Use only completed sessions for progression as well – ongoing sessions are typically "in flight" and don't represent stable performance.
    const sessions = await prisma.climbingSession.findMany({
      where: {
        userId,
        endTime: { not: null },
      },
      include: {
        attempts: {
          select: {
            status: true,
            voterGrade: true,
            proposedGrade: true,
            gradeSystem: true,
          },
        },
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferredGradeSystem: true },
    });

    return this.calculateGradeProgressionFromSessions(
      sessions,
      user?.preferredGradeSystem || null
    );
  }

  async calculateInsightsAndProgression(userId, options = {}) {
    const sessions = await prisma.climbingSession.findMany({
      where: {
        userId,
        endTime: { not: null },
      },
      include: {
        attempts: true,
      },
    });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferredGradeSystem: true },
    });
    const preferredGradeSystem = user?.preferredGradeSystem || null;

    const insights = await this.calculateInsightsFromSessions(sessions, {
      ...options,
      preferredGradeSystem,
    });
    const progression = this.calculateGradeProgressionFromSessions(
      // progression only needs a subset of attempt fields; passing full attempts is fine
      sessions.map((s) => ({
        ...s,
        attempts: s.attempts.map((a) => ({
          status: a.status,
          voterGrade: a.voterGrade,
          proposedGrade: a.proposedGrade,
          gradeSystem: a.gradeSystem,
        })),
      })),
      preferredGradeSystem
    );

    return {
      insights,
      progression,
    };
  }
}

const sessionService = new SessionService();

export default sessionService;
