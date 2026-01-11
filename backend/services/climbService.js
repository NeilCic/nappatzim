import PrismaCrudService from "./prismaCrudService.js";
import { CLIMB_MODEL } from "../lib/dbModels.js";

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
    return await this.delete({ id: climbId });
  }
}

const climbService = new ClimbService();

export default climbService;
