import express, { json } from 'express';
import workoutRouter from './routes/workouts.js';
import authRouter from './routes/auth.js';
import categoryRouter from './routes/category.js'
import cors from 'cors';

const app = express();
app.use(json());
app.use(cors());

app.use('/workouts', workoutRouter);
app.use('/auth', authRouter);
app.use('/categories', categoryRouter)

const PORT = 3000;
const IP = '0.0.0.0';
app.listen(PORT, IP, () => {
  console.log(`Server running on http://${IP}:${PORT}`);
});