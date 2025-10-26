import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';

const hashPassword = async (password) => {
    const saltRounds = 10;
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
    const { email, password } = data;

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
    const { email, password } = credentials;
    
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