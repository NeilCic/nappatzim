import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { z } from 'zod';

const userSchema = z.object({
    // email: z.email(),
    email: z.string().min(3, "User name has to be at least 3 characters").max(20, "User name can't be more than 20 characters"),
    password: z.string().min(6, "Password has to be at least 6 characters").max(20, "Password can't be more than 20 characters"),
    role: z.enum(['user', 'admin']).default('user')
});

const hashPassword = async (password) => {
    const saltRounds = 15;
    return await bcrypt.hash(password, saltRounds);
};

const verifyPassword = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};

const generateTokens = (userId, email, role) => {
    const accessToken = jwt.sign(
        { userId, email, role },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
    );
    
    const refreshToken = jwt.sign(
        { userId, email, role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
    
    return { accessToken, refreshToken };
};

const registerUser = async (data) => {
    const validatedData = userSchema.safeParse(data);
    const { email, password } =  validatedData.data;
    if (!validatedData.success) {
        const errorArray = JSON.parse(validatedData.error.message);
        throw new Error (errorArray[0].message);
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
        data: {
            email,
            passwordHash,
            role: 'user'
        }
    });
    
    return { id: user.id };
};

const loginUser = async (credentials) => {
    const { email, password } = credentials;  // todo add zod validation
    
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error('Invalid user name');
    
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) throw new Error('Invalid password');

    const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role);
    
    return {
        accessToken,
        refreshToken,
        userId: user.id,
        email: user.email,
        role: user.role
    };
};

const refreshAccessToken = async (refreshToken) => {
    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
        
        const newAccessToken = jwt.sign(
            { userId: decoded.userId, email: decoded.email, role: decoded.role },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );
        
        return { accessToken: newAccessToken };
    } catch (error) {
        throw new Error('Invalid refresh token');
    }
};

export { registerUser, loginUser, refreshAccessToken };