import PrismaCrudService from "./prismaCrudService.js";
import prisma from "../lib/prisma.js";
import { calculateAverageGrade } from "../lib/gradeUtils.js";
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

  async addRouteAttempt(sessionId, climbId, isSuccess, attempts) {
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
    const { limit = 20, cursor, includeStatistics = false } = options;

    const where = { userId };

    if (cursor) {
      where.createdAt = { lt: new Date(cursor) };
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

    const hasMore = sessions.length > limit;
    const results = hasMore ? sessions.slice(0, limit) : sessions;
    const nextCursor = hasMore ? results[results.length - 1].createdAt.toISOString() : null;

    let sessionsToReturn = results;
    if (includeStatistics) {
      sessionsToReturn = results.map((session) => ({
        ...session,
        statistics: calculateSessionStatistics(session.attempts || []),
      }));
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
}

const sessionService = new SessionService();

export default sessionService;
