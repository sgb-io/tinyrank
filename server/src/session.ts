import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { sessions } from './store';
import { Session } from './types';

const SESSION_COOKIE = 'tinyrank_session';
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

declare global {
  namespace Express {
    interface Request {
      session: Session;
    }
  }
}

export function sessionMiddleware(req: Request, res: Response, next: NextFunction): void {
  let sessionId = req.cookies[SESSION_COOKIE];
  let session = sessionId ? sessions.get(sessionId) : undefined;

  if (!session) {
    sessionId = uuidv4();
    session = {
      id: sessionId,
      pollsCreated: [],
      createdAt: Date.now(),
    };
    sessions.set(sessionId, session);
    res.cookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      maxAge: SESSION_TTL,
      sameSite: 'lax',
    });
  }

  req.session = session;
  next();
}
