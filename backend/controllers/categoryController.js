import categoryService from '../services/categoryService.js';
import logger from '../lib/logger.js';
import { z } from 'zod';

const categorySchema = z.object({
    name: z.string().min(1, "Category name is required"),
    color: z.string().optional(),
});

const getCategoriesController = async (req, res) => {
    const requestId = Date.now().toString();
    try {
        logger.info(
            { requestId, userId: req.user.userId },
            "Getting categories"
        );

        const categories = await categoryService.getCategories(req.user.userId);

        logger.info({ requestId, userId: req.user.userId, count: categories.length }, "Categories retrieved");
        res.json(categories);
    } catch (error) {
        logger.error(
            {
                requestId,
                userId: req.user.userId,
                error: error.message,
                stack: error.stack,
            },
            "Failed to get categories - server error"
        );
        res.status(500).json({ error: "Internal server error" });
    }
};

const createCategoryController = async (req, res) => {
    const requestId = Date.now().toString();
    try {
        logger.info(
            { requestId, userId: req.user.userId, requestBody: req.body },
            "Creating category"
        );

        const validatedData = categorySchema.parse(req.body);
        const category_id = await categoryService.createCategory({
            ...validatedData,
            userId: req.user.userId,
        });

        logger.info({ requestId, userId: req.user.userId, categoryId: category_id }, "Category created");
        res.status(201).json({ id: category_id });
    } catch (error) {
        if (error.name === "ZodError") {
            logger.warn(
                {
                    requestId,
                    userId: req.user.userId,
                    validationError: error,
                },
                "Category creation validation failed"
            );
            res.status(400).json({ error: error.message });
        } else if (error.statusCode === 409) {
            logger.warn({ requestId, userId: req.user.userId, name: validatedData.name }, "Category name already exists");
            res.status(409).json({ error: error.message });
        } else {
            logger.error(
                {
                    requestId,
                    userId: req.user.userId,
                    error: error.message,
                    stack: error.stack,
                },
                "Failed to create category - server error"
            );
            res.status(500).json({ error: "Internal server error" });
        }
    }
};

const getCategoryByIdController = async (req, res) => {
    const requestId = Date.now().toString();
    try {
        const { id } = req.params;
        logger.info(
            { requestId, userId: req.user.userId, categoryId: id },
            "Getting category by ID"
        );

        const category = await categoryService.getCategoryById(id, req.user.userId);
        
        if (!category) {
            logger.warn(
                { requestId, userId: req.user.userId, categoryId: id },
                "Category not found"
            );
            return res.status(404).json({ error: 'Category not found' });
        }
        
        logger.info({ requestId, userId: req.user.userId, categoryId: id }, "Category retrieved");
        res.json(category);
    } catch (error) {
        logger.error(
            {
                requestId,
                userId: req.user.userId,
                categoryId: req.params.id,
                error: error.message,
                stack: error.stack,
            },
            "Failed to get category by ID - server error"
        );
        res.status(500).json({ error: "Internal server error" });
    }
};

const updateCategoryController = async (req, res) => {
    const requestId = Date.now().toString();
    try {
        const { id } = req.params;
        logger.info(
            { requestId, userId: req.user.userId, categoryId: id, requestBody: req.body },
            "Updating category"
        );

        const validatedData = categorySchema.partial().parse(req.body);
        const category = await categoryService.updateCategory(id, validatedData, req.user.userId);

        logger.info({ requestId, userId: req.user.userId, categoryId: id }, "Category updated");
        res.json(category);
    } catch (error) {
        if (error.name === "ZodError") {
            logger.warn(
                {
                    requestId,
                    userId: req.user.userId,
                    categoryId: req.params.id,
                    validationError: error,
                },
                "Category update validation failed"
            );
            res.status(400).json({ error: error.message });
        } else {
            logger.error(
                {
                    requestId,
                    userId: req.user.userId,
                    categoryId: req.params.id,
                    error: error.message,
                    stack: error.stack,
                    requestBody: req.body,
                },
                "Failed to update category - server error"
            );
            res.status(500).json({ error: "Internal server error" });
        }
    }
};

const deleteCategoryController = async (req, res) => {
    const requestId = Date.now().toString();
    try {
        const { id } = req.params;
        logger.info(
            { requestId, userId: req.user.userId, categoryId: id },
            "Deleting category"
        );

        await categoryService.deleteCategory(id, req.user.userId);

        logger.info({ requestId, userId: req.user.userId, categoryId: id }, "Category deleted");
        res.status(204).send();
    } catch (error) {
        logger.error(
            {
                requestId,
                userId: req.user.userId,
                categoryId: req.params.id,
                error: error.message,
                stack: error.stack,
            },
            "Failed to delete category - server error"
        );
        res.status(500).json({ error: "Internal server error" });
    }
};

export { 
    getCategoriesController, 
    createCategoryController, 
    getCategoryByIdController, 
    updateCategoryController, 
    deleteCategoryController 
};