import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import PrismaCrudService from './prismaCrudService.js';
import { USER_MODEL } from '../lib/dbModels.js';
import climbVoteService from './climbVoteService.js';

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



class AuthService extends PrismaCrudService {
    constructor() {
        super(USER_MODEL);
    }

    async checkUserExists(email) {
        return await this.hasOne({ email });
    }

    async checkUsernameExists(username) {
        return await this.hasOne({ username });
    }

    async loginUser(credentials) {
        const { email, password } = credentials;


        const user = await this.getOne({ email });
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
    }

    async registerUser(data) {
        const { email, password } = data;
        const passwordHash = await hashPassword(password);
        
        // Extract username from email (part before @)
        let username = email.includes('@') ? email.split('@')[0] : email;
        
        // If username is already taken, append a number
        let finalUsername = username;
        let counter = 1;
        while (await this.checkUsernameExists(finalUsername)) {
            finalUsername = `${username}${counter}`;
            counter++;
        }
        
        const user = await this.create({ 
            email, 
            passwordHash, 
            role: 'user',
            username: finalUsername 
        });
        return { id: user.id };
    }

    async updateUserProfile(userId, data) {
        const { username, height } = data;
        const updateData = {};
        
        if (username !== undefined) {
            updateData.username = username;
        }
        
        if (height !== undefined) {
            updateData.height = height;
            await climbVoteService.updateVotesHeightByUserId(userId, height);
        }
        
        try {
            return await this.update({ id: userId }, updateData);
        } catch (error) {
            // Handle Prisma unique constraint violation (P2002) for username
            if (error.code === 'P2002' && error.meta?.target?.includes('username')) {
                const conflictError = new Error("Username already taken");
                conflictError.statusCode = 409;
                throw conflictError;
            }
            throw error;
        }
    }
}

const authService = new AuthService();

export { authService, refreshAccessToken };