import { registerUser, loginUser, refreshAccessToken } from '../services/authService.js'

const addUser = async(req, res) => {
    try {
        const { email, password } = req.body;
        const user_id = await registerUser({ email, password });
        res.status(201).json({ id: user_id });
    } catch (error) {
         res.status(400).json({ error: error.message });
    }
};

const login = async(req, res) => {
    try {
        const { email, password } = req.body;
        const result = await loginUser({ email, password });
        res.json(result)
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
}

const refresh = async(req, res) => {
    try {
        const { refreshToken } = req.body;
        const result = await refreshAccessToken(refreshToken);
        res.json(result);
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
};

export { addUser, login, refresh };