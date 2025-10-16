import prisma from '../lib/prisma.js';
import { z } from 'zod';

const categorySchema = z.object({
    name: z.string(),
    color: z.string().optional(),
    userId: z.string()
});

export const getCategories = async (userId) => {
    try {
        const categories = await prisma.workoutCategory.findMany({
            where: { userId },
        });
        return categories;
    } catch (error) {
        throw new Error('Failed to fetch categories');
    }
};

export const createCategory = async(data) => {
    const validatedData = categorySchema.parse(data);
    const category = await prisma.workoutCategory.create({
        data: validatedData
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
    const validatedData = categorySchema.partial().parse(data);
    const category = await prisma.workoutCategory.update({
        where: { 
            id: categoryId,
            userId 
        },
        data: validatedData
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