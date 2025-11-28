import prisma from "../lib/prisma.js";

class PrismaCrudService {
  constructor(model, defaultInclude = undefined, defaultOrderBy = undefined) {
    this.model = model;
    this.include = defaultInclude;
    this.orderBy = defaultOrderBy;
  }

  async getAll({ where = {}, include, orderBy, limit } = {}) {
    return await prisma[this.model].findMany({
      where,
      include: include || this.include,
      orderBy: orderBy || this.orderBy,
      ...(limit && { take: parseInt(limit, 10) }),
    });
  }

  async getOne(where, include) {
    return await prisma[this.model].findFirst({ where, include: include || this.include });
  }

  async create(data, include) {
    return await prisma[this.model].create({ data, include: include || this.include });
  }

  async update(where, data, include) {
    return await prisma[this.model].update({ where, data, include: include || this.include });
  }

  async delete(where) {
    return await prisma[this.model].delete({ where });
  }

  async hasOne(where = {}) {
    const count = await prisma[this.model].count({ where });
    return count > 0;
  }

  async count(where = {}) {
    return await prisma[this.model].count({ where });
  }
}

export default PrismaCrudService;
