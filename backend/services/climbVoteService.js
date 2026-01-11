import PrismaCrudService from "./prismaCrudService.js";
import { CLIMB_GRADE_VOTE_MODEL } from "../lib/dbModels.js";
import prisma from "../lib/prisma.js";
import climbService from "./climbService.js";
import { calculateAverageGrade } from "../lib/gradeUtils.js";

class ClimbVoteService extends PrismaCrudService {
  constructor() {
    super(CLIMB_GRADE_VOTE_MODEL, { climb: true, user: { select: { id: true, username: true, height: true } } }, { createdAt: "desc" });
  }

  async getVotesByClimb(climbId) {
    return await this.getAll({
      where: { climbId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            height: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getVoteByUserAndClimb(climbId, userId) { // todo see if this is needed
    return await this.getOne(
      { climbId, userId },
      {
        climb: true,
        user: {
          select: {
            id: true,
            username: true,
            height: true,
          },
        },
      }
    );
  }

  async submitOrUpdateVote(climbId, userId, grade, gradeSystem, height) {
    return await prisma.climbGradeVote.upsert({ // todo maybe add this to prisma crud service
      where: {
        climbId_userId: {
          climbId,
          userId,
        },
      },
      update: {
        grade,
        gradeSystem,
        height: height || null,
      },
      create: {
        climbId,
        userId,
        grade,
        gradeSystem,
        height: height || null,
      },
      include: {
        climb: true,
        user: {
          select: {
            id: true,
            username: true,
            height: true,
          },
        },
      },
    });
  }

  async deleteVote(climbId, userId) {
    return await this.delete({ climbId, userId });
  }

  async getVoteStatistics(climbId) {
    const climb = await climbService.getClimbById(climbId);
    if (!climb) {
      throw new Error(`Climb with ID ${climbId} not found`);
    }

    const votes = await this.getAll({
      where: { climbId },
      select: {
        grade: true,
        height: true,
      },
    });

    if (votes.length === 0) {
      return {
        totalVotes: 0,
        averageGrade: null,
        gradeDistribution: {},
        heightBreakdown: {},
        gradeByHeight: {},
      };
    }

    // Calculate grade distribution
    const gradeDistribution = {};
    votes.forEach((vote) => {
      gradeDistribution[vote.grade] = (gradeDistribution[vote.grade] || 0) + 1;
    });

    // Calculate height breakdown (group by height ranges)
    const heightBreakdown = {
      withHeight: 0,
      withoutHeight: 0,
      byRange: {
        "short": 0,    // < 165cm
        "average": 0,  // 165-180cm
        "tall": 0,     // > 180cm
      },
    };

    const gradeByHeight = {};

    votes.forEach((vote) => {
      if (!gradeByHeight[vote.grade]) {
        gradeByHeight[vote.grade] = {
          short: 0,
          average: 0,
          tall: 0,
          noHeight: 0,
        };
      }

      if (vote.height) {
        heightBreakdown.withHeight++;
        let heightCategory = 'noHeight';
        if (vote.height < 165) {
          heightBreakdown.byRange.short++;
          heightCategory = 'short';
        } else if (vote.height <= 180) {
          heightBreakdown.byRange.average++;
          heightCategory = 'average';
        } else {
          heightBreakdown.byRange.tall++;
          heightCategory = 'tall';
        }
        gradeByHeight[vote.grade][heightCategory]++;
      } else {
        heightBreakdown.withoutHeight++;
        gradeByHeight[vote.grade].noHeight++;
      }
    });

    // Calculate average grade
    const grades = votes.map(vote => vote.grade);
    const averageGrade = calculateAverageGrade(grades, climb.gradeSystem);

    return {
      totalVotes: votes.length,
      averageGrade,
      gradeDistribution,
      heightBreakdown,
      gradeByHeight,
    };
  }
}

const climbVoteService = new ClimbVoteService();

export default climbVoteService;
