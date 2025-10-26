import { registerUser, loginUser, refreshAccessToken } from '../services/authService.js'
import logger from '../lib/logger.js'
import { z } from 'zod'

const userSchema = z.object({
    email: z.string().min(3, "User name has to be at least 3 characters").max(20, "User name can't be more than 20 characters"),
    password: z.string().min(6, "Password has to be at least 6 characters").max(20, "Password can't be more than 20 characters"),
    role: z.enum(['user', 'admin']).default('user')
});

const loginSchema = z.object({
    email: z.string().min(3, "User name has to be at least 3 characters").max(20, "User name can't be more than 20 characters"),
    password: z.string().min(6, "Password has to be at least 6 characters").max(20, "Password can't be more than 20 characters")
});

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

        const user_id = await registerUser({ email, password });

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
            res.status(400).json({ error: error.message });
        } else {
            logger.error(
                {
                    requestId,
                    email: req.body.email,
                    error: error.message,
                    stack: error.stack,
                    requestBody: req.body,
                },
                "Failed to register user - server error"
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

        const result = await loginUser({ email, password });

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
            res.status(400).json({ error: error.message });
        } else {
            logger.warn(
                {
                    requestId,
                    email: req.body.email,
                    error: error.message,
                    requestBody: req.body,
                },
                "User login failed"
            );
            res.status(401).json({ error: error.message });
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
            res.status(400).json({ error: error.message });
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

export { addUser, login, refresh };