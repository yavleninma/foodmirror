import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './lib/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { insightRouter } from './routes/insight.js';
import { historyRouter } from './routes/history.js';
import { statsRouter } from './routes/stats.js';
import { userRouter } from './routes/user.js';
import { healthRouter } from './routes/health.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/insight', insightRouter);
app.use('/api/history', historyRouter);
app.use('/api/stats', statsRouter);
app.use('/api/user', userRouter);
app.use('/api/health', healthRouter);

// В продакшене сервим фронтенд из apps/web/dist
if (env.NODE_ENV === 'production') {
  const webDist = path.resolve(__dirname, '../../web/dist');
  app.use(express.static(webDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`FoodMirror API: http://localhost:${env.PORT}`);
});
