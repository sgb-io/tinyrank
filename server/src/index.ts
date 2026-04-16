import express, { Request, Response, NextFunction } from 'express';
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

// CSRF protection: for state-changing API requests, verify the Origin header
// matches the server host to prevent cross-site request forgery.
function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    next();
    return;
  }
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        res.status(403).json({ error: 'CSRF check failed' });
        return;
      }
    } catch {
      res.status(403).json({ error: 'Invalid origin' });
      return;
    }
  }
  next();
}

app.use('/api', csrfProtection);
app.use('/api', pollsRouter);
app.use('/api', eventsRouter);

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');

  // Simple rate limiter for static file serving (max 200 requests/minute per IP)
  const staticRateMap = new Map<string, { count: number; resetAt: number }>();
  const STATIC_RATE_LIMIT = 200;
  const STATIC_RATE_WINDOW = 60 * 1000;

  function staticRateLimit(req: Request, res: Response, next: NextFunction): void {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    const entry = staticRateMap.get(ip);
    if (!entry || entry.resetAt < now) {
      staticRateMap.set(ip, { count: 1, resetAt: now + STATIC_RATE_WINDOW });
      next();
      return;
    }
    entry.count++;
    if (entry.count > STATIC_RATE_LIMIT) {
      res.status(429).json({ error: 'Too many requests' });
      return;
    }
    next();
  }

  app.use(staticRateLimit);
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  // Periodically prune expired rate-limit entries
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of staticRateMap.entries()) {
      if (entry.resetAt < now) staticRateMap.delete(ip);
    }
  }, STATIC_RATE_WINDOW);
}

app.listen(PORT, () => {
  console.log(`TinyRank server running on port ${PORT}`);
});

