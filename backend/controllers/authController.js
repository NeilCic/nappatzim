import { authService, refreshAccessToken } from '../services/authService.js'
import logger from '../lib/logger.js'
import { z } from 'zod'
import { formatZodError } from '../lib/zodErrorFormatter.js'
import { VALIDATION } from '../../mobile/src/shared/constants.js'

const userSchema = z.object({
    email: z.string()
        .min(VALIDATION.EMAIL.MIN_LENGTH, `Email has to be at least ${VALIDATION.EMAIL.MIN_LENGTH} characters`)
        .max(VALIDATION.EMAIL.MAX_LENGTH, `Email can't be more than ${VALIDATION.EMAIL.MAX_LENGTH} characters`),
    password: z.string()
        .min(VALIDATION.PASSWORD.MIN_LENGTH, `Password has to be at least ${VALIDATION.PASSWORD.MIN_LENGTH} characters`)
        .max(VALIDATION.PASSWORD.MAX_LENGTH, `Password can't be more than ${VALIDATION.PASSWORD.MAX_LENGTH} characters`),
    role: z.enum(['user', 'admin']).default('user')
});

// for after testing
// const userSchema = z.object({
//     email: z.string()
//         .email("Email must be a valid email address")
//         .min(3, "Email must be at least 3 characters")
//         .max(80, "Email can't be more than 50 characters"),
//     password: z.string()
//         .min(8, "Password must be at least 8 characters")
//         .max(32, "Password can't be more than 32 characters")
//         .regex(/[a-z]/, "Password must contain at least one lowercase letter")
//         .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
//         .regex(/[0-9]/, "Password must contain at least one number")
//         .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
//     role: z.enum(['user', 'admin']).default('user')
// });

const loginSchema = z.object({
    email: z.string()
        .min(VALIDATION.EMAIL.MIN_LENGTH, `User name has to be at least ${VALIDATION.EMAIL.MIN_LENGTH} characters`)
        .max(VALIDATION.EMAIL.MAX_LENGTH, `User name can't be more than ${VALIDATION.EMAIL.MAX_LENGTH} characters`),
    password: z.string()
        .min(VALIDATION.PASSWORD.MIN_LENGTH, `Password has to be at least ${VALIDATION.PASSWORD.MIN_LENGTH} characters`)
        .max(VALIDATION.PASSWORD.MAX_LENGTH, `Password can't be more than ${VALIDATION.PASSWORD.MAX_LENGTH} characters`)
});

// for after testing
// const loginSchema = z.object({
//     email: z.string()
//         .email("Email must be a valid email address")
//         .min(3, "Email must be at least 3 characters")
//         .max(50, "Email can't be more than 50 characters"),
//     password: z.string()
//         .min(8, "Password must be at least 8 characters")
//         .max(32, "Password can't be more than 32 characters")
// });

const refreshSchema = z.object({
    refreshToken: z.string().min(1, "Refresh token is required")
});

const addUser = async(req, res) => {
    const requestId = Date.now().toString();
    try {
        logger.info(
            { requestId, email: req.body.email },
            "Registering new user"
        );

        const validatedData = userSchema.parse(req.body);
        const { email, password } = validatedData;

        const emailExists = await authService.checkUserExists(email);
        if (emailExists) {
            logger.warn({ requestId, email }, "User with this email already exists");
            return res.status(409).json({ error: "User with this email already exists" });
        }

        const user_id = await authService.registerUser({ email, password });

        logger.info({ requestId, userId: user_id, email }, "User registered successfully");
        res.status(201).json({ id: user_id });
    } catch (error) {
        if (error.name === "ZodError") {
            logger.warn(
                {
                    requestId,
                    email: req.body.email,
                    validationError: error,
                },
                "User registration validation failed"
            );
            const formattedError = formatZodError(error);
            res.status(400).json({ error: formattedError });
        } else {
            logger.error(
                {
                    requestId,
                    email: req.body.email,
                    error: error.message,
                    stack: error.stack,
                },
                "User registration failed"
            );
            res.status(500).json({ error: "Internal server error" });
        }
    }
};

const login = async(req, res) => {
    const requestId = Date.now().toString();
    try {
        logger.info(
            { requestId, email: req.body.email },
            "User login attempt"
        );

        const validatedData = loginSchema.parse(req.body);
        const { email, password } = validatedData;
        const result = await authService.loginUser({ email, password });

        logger.info({ requestId, userId: result.userId, email }, "User logged in successfully");
        res.json(result)
    } catch (error) {
        if (error.name === "ZodError") {
            logger.warn(
                {
                    requestId,
                    email: req.body.email,
                    validationError: error,
                },
                "User login validation failed"
            );
            const formattedError = formatZodError(error);
            res.status(400).json({ error: formattedError });
        } else if (error.message === 'Invalid credentials') {
            logger.warn(
                {
                    requestId,
                    email: req.body.email,
                },
                "User login failed - invalid credentials"
            );
            res.status(401).json({ error: error.message });
        } else {
            logger.error(
                {
                    requestId,
                    email: req.body.email,
                    error: error.message,
                    stack: error.stack,
                },
                "User login failed - unexpected error"
            );
            res.status(500).json({ error: "Login failed. Please try again." });
        }
    }
}

const refresh = async(req, res) => {
    const requestId = Date.now().toString();
    try {
        logger.info(
            { requestId },
            "Refreshing access token"
        );

        const validatedData = refreshSchema.parse(req.body);
        const { refreshToken } = validatedData;

        const result = await refreshAccessToken(refreshToken);

        logger.info({ requestId, userId: result.userId }, "Access token refreshed successfully");
        res.json(result);
    } catch (error) {
        if (error.name === "ZodError") {
            logger.warn(
                {
                    requestId,
                    validationError: error,
                },
                "Token refresh validation failed"
            );
            const formattedError = formatZodError(error);
            res.status(400).json({ error: formattedError });
        } else {
            logger.warn(
                {
                    requestId,
                    error: error.message,
                    requestBody: req.body,
                },
                "Token refresh failed"
            );
            res.status(401).json({ error: error.message });
        }
    }
};


const getCurrentUser = async (req, res) => {
    const requestId = Date.now().toString();
    try {
        logger.info(
            { requestId, userId: req.user.userId },
            "Fetching current user"
        );

        const user = await authService.getOne(
          { id: req.user.userId },
          undefined,
          { id: true, email: true, username: true, height: true, preferredGradeSystem: true }
        );
        if (!user) {
            logger.warn({ requestId, userId: req.user.userId }, "User not found");
            return res.status(404).json({ error: "User not found" });
        }

        logger.info({ requestId, userId: req.user.userId }, "Current user fetched");
        res.json(user);
    } catch (error) {
        logger.error(
            {
                requestId,
                userId: req.user.userId,
                error: error.message,
                stack: error.stack,
            },
            "Failed to fetch current user"
        );
        res.status(500).json({ error: "Internal server error" });
    }
};

const updateProfileSchema = z.object({
    username: z.string()
        .min(VALIDATION.USERNAME.MIN_LENGTH, `Username must be at least ${VALIDATION.USERNAME.MIN_LENGTH} characters`)
        .max(VALIDATION.USERNAME.MAX_LENGTH, `Username can't be more than ${VALIDATION.USERNAME.MAX_LENGTH} characters`)
        .optional(),
    height: z.coerce.number()
        .positive("Height must be a positive number")
        .nullable()
        .optional(),
    preferredGradeSystem: z.enum(['V-Scale', 'V-Scale Range', 'French']).optional(),
});

const updateProfile = async (req, res) => {
    const requestId = Date.now().toString();
    try {
        logger.info(
            { requestId, userId: req.user.userId, body: req.body },
            "Updating user profile"
        );

        const validatedData = updateProfileSchema.parse(req.body);
        const user = await authService.updateUserProfile(req.user.userId, validatedData);

        logger.info({ requestId, userId: req.user.userId }, "User profile updated successfully");
        res.json({
          id: user.id,
          username: user.username,
          height: user.height,
          preferredGradeSystem: user.preferredGradeSystem || null,
        });
    } catch (error) {
        if (error.name === "ZodError") {
            logger.warn(
                {
                    requestId,
                    userId: req.user.userId,
                    validationError: error,
                },
                "Profile update validation failed"
            );
            const formattedError = formatZodError(error);
            res.status(400).json({ error: formattedError });
        } else if (error.message === "Username already taken") {
            logger.warn({ requestId, userId: req.user.userId, username: req.body.username }, "Username already taken");
            res.status(409).json({ error: error.message });
        } else {
            logger.error(
                {
                    requestId,
                    userId: req.user.userId,
                    error: error.message,
                    stack: error.stack,
                },
                "Profile update failed"
            );
            res.status(500).json({ error: "Internal server error" });
        }
    }
};

export { addUser, login, refresh, getCurrentUser, updateProfile };