import { getCategories, createCategory, getCategoryById, updateCategory, deleteCategory } from '../services/categoryService.js';

const getCategoriesController = async (req, res) => {
    try {
        const categories = await getCategories(req.user.userId);
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createCategoryController = async (req, res) => {
    try {
        const category_id = await createCategory({ ...req.body, userId: req.user.userId });
        res.status(201).json({ id: category_id });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const getCategoryByIdController = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await getCategoryById(id, req.user.userId);
        
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }
        
        res.json(category);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateCategoryController = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await updateCategory(id, req.body, req.user.userId);
        res.json(category);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const deleteCategoryController = async (req, res) => {
    try {
        const { id } = req.params;
        await deleteCategory(id, req.user.userId);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export { 
    getCategoriesController, 
    createCategoryController, 
    getCategoryByIdController, 
    updateCategoryController, 
    deleteCategoryController 
};