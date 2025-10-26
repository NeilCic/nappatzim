import prisma from '../lib/prisma.js';

export const getCategories = async (userId) => {
    try {
        const categories = await prisma.workoutCategory.findMany({
            where: { userId },
            include: {
                _count: {
                    select: { workouts: true }
                }
            }
        });
        return categories;
    } catch (error) {
        throw new Error('Failed to fetch categories');
    }
};

export const createCategory = async(data) => {
    const category = await prisma.workoutCategory.create({
        data: data
    });
    return category.id;
};

export const getCategoryById = async (categoryId, userId) => {
    const category = await prisma.workoutCategory.findFirst({
        where: { 
            id: categoryId,
            userId 
        }
    });
    return category;
};

export const updateCategory = async (categoryId, data, userId) => {
    const category = await prisma.workoutCategory.update({
        where: { 
            id: categoryId,
            userId 
        },
        data: data
    });
    return category;
};

export const deleteCategory = async (categoryId, userId) => {
    const category = await prisma.workoutCategory.delete({
        where: { 
            id: categoryId,
            userId 
        }
    });
    return category;
};