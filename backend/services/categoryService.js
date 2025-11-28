import PrismaCrudService from "./prismaCrudService.js";
import { CATEGORY_MODEL } from "../lib/dbModels.js";
import { getCache, setCache, invalidateCache, cacheKeys } from "../lib/cache.js";

const categoryInclude = {
    workouts: true,
};
const categoryOrderBy = { name: "asc" };

// cache TTL: 10 minutes for categories (they rarely change)
const CATEGORY_CACHE_TTL = 600;

class CategoryService extends PrismaCrudService {
    constructor() {
      super(CATEGORY_MODEL, categoryInclude, categoryOrderBy);
    }

    async getCategories(userId) {
        const cacheKey = cacheKeys.userCategories(userId);
        const cached = await getCache(cacheKey);
        if (cached) {
            return cached;
        }

        const categories = await this.getAll({
            where: { userId },
            include: {
                _count: {
                    select: { workouts: true }
                }
            }
        });

        // Store in cache
        await setCache(cacheKey, categories, CATEGORY_CACHE_TTL);
        return categories;
    }

    async createCategory(data) {
        const created = await this.create(data);
        // Invalidate user's category cache
        await invalidateCache(cacheKeys.userCategories(data.userId));
        return created.id;
    }

    async checkCategoryExists(name, userId) {
        return await this.hasOne({ name, userId });
    }

    async getCategoryById(categoryId, userId) {
        return await this.getOne({ id: categoryId, userId });
    }

    async updateCategory(categoryId, data, userId) {
        const updated = await this.update({ id: categoryId, userId }, data);
        await invalidateCache(cacheKeys.userCategories(userId));
        return updated;
    }

    async deleteCategory(categoryId, userId) {
        const deleted = await this.delete({ id: categoryId, userId });
        await invalidateCache(cacheKeys.userCategories(userId));
        return deleted;
    }
}

const categoryService = new CategoryService();

export default categoryService;