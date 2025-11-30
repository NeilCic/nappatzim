import prisma from "../lib/prisma.js";

class PrismaCrudService {
  constructor(model, defaultInclude = undefined, defaultOrderBy = undefined) {
    this.model = model;
    this.include = defaultInclude;
    this.orderBy = defaultOrderBy;
  }

  async getAll({ where = {}, include, orderBy, limit, select } = {}) {
    const query = {
      where,
      orderBy: orderBy || this.orderBy,
      ...(limit && { take: parseInt(limit, 10) }),
    };
    
    // select and include are mutually exclusive in Prisma
    if (select) {
      query.select = select;
    } else {
      query.include = include || this.include;
    }
    
    return await prisma[this.model].findMany(query);
  }

  async getOne(where, include, select) {
    const query = { where };
    
    // select and include are mutually exclusive in Prisma
    if (select) {
      query.select = select;
    } else {
      query.include = include || this.include;
    }
    
    return await prisma[this.model].findFirst(query);
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
