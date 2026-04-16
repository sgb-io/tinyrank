import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { sessionMiddleware } from './session';
import { pollsRouter } from './routes/polls';
import { eventsRouter } from './routes/events';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cookieParser());
app.use(express.json());
app.use(sessionMiddleware);

app.use('/api', pollsRouter);
app.use('/api', eventsRouter);

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`TinyRank server running on port ${PORT}`);
});
