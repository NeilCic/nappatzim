import 'dotenv/config';
import express, { json } from 'express';
import workoutRouter from './backend/routes/workouts.js';
import authRouter from './backend/routes/auth.js';
import categoryRouter from './backend/routes/category.js';
import chatRouter from './backend/routes/chat.js';
import cors from 'cors';
import compression from 'compression';

const app = express();
app.use(compression());
app.use(json());
app.use(cors());

app.use('/workouts', workoutRouter);
app.use('/auth', authRouter);
app.use('/categories', categoryRouter);
app.use('/chat', chatRouter);

const PORT = process.env.PORT || 3000;
const IP = '0.0.0.0';
app.listen(PORT, IP, () => {
  console.log(`Server running on http://${IP}:${PORT}`);
});