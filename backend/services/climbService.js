import PrismaCrudService from "./prismaCrudService.js";
import { CLIMB_MODEL } from "../lib/dbModels.js";
import sessionService from "./sessionService.js";

class ClimbService extends PrismaCrudService {
  constructor() {
    super(CLIMB_MODEL, { spot: { include: { layout: true } }, setter: true }, { createdAt: "desc" });
  }

  async getClimbsBySpot(spotId) {
    return await this.getAll({
      where: { spotId },
      include: {
        setter: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        votes: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                height: true,
              },
            },
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
            reactions: true,
          },
        },
        videos: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getClimbById(climbId) {
    return await this.getOne(
      { id: climbId },
      {
        spot: {
          include: {
            layout: true,
            user: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
        },
        setter: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        votes: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                height: true,
              },
            },
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
            reactions: true,
            replies: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
                reactions: true,
              },
            },
          },
        },
        videos: {
          orderBy: { createdAt: "desc" },
        },
      }
    );
  }

  async createClimb(data) {
    return await this.create(data);
  }

  async updateClimb(climbId, userId, data) {
    // TODO: Add ownership check (spot owner or admin)
    return await this.update({ id: climbId }, data);
  }

  async deleteClimb(climbId, userId) {
    // TODO: Add ownership check (spot owner or admin)
    
    try {
      const climb = await this.getOne(
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
        await sessionService.updateAttemptsOnClimbDeletion(climbId, climb);
      }
    } catch (error) {
      console.error("Error fetching climb data or updating session routes before deletion:", error);
    }
    
    return await this.delete({ id: climbId });
  }
}

const climbService = new ClimbService();

export default climbService;
