import PrismaCrudService from "./prismaCrudService.js";
import { CATEGORY_MODEL } from "../lib/dbModels.js";
import { getCache, setCache, invalidateCache, cacheKeys } from "../lib/cache.js";

const categoryOrderBy = { name: "asc" };

// cache TTL: 10 minutes for categories (they rarely change)
const CATEGORY_CACHE_TTL = 600;

class CategoryService extends PrismaCrudService {
    constructor() {
      super(CATEGORY_MODEL, undefined, categoryOrderBy);
    }

    async getCategories(userId) {
        const cacheKey = cacheKeys.userCategories(userId);
        const cached = await getCache(cacheKey);
        if (cached) {
            return cached;
        }

        const categories = await this.getAll({
            where: { userId },
            select: {
                id: true,
                name: true,
                color: true,
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
        try {
            const created = await this.create(data);
            // Invalidate user's category cache
            await invalidateCache(cacheKeys.userCategories(data.userId));
            return created.id;
        } catch (error) {
            // Handle Prisma unique constraint violation (P2002) for duplicate category name
            if (error.code === 'P2002' && error.meta?.target?.includes('name')) {
                const conflictError = new Error("Category name already exists");
                conflictError.statusCode = 409;
                throw conflictError;
            }
            throw error;
        }
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