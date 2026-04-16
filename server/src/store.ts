import { Poll, Session } from './types';

export const polls = new Map<string, Poll>();
export const sessions = new Map<string, Session>();

export const MAX_POLLS_PER_USER = 10;
export const MAX_GLOBAL_POLLS = 5000;
export const POLL_TTL = 24 * 60 * 60 * 1000; // 24 hours

export function cleanupExpiredPolls(): void {
  const now = Date.now();
  for (const [code, poll] of polls.entries()) {
    if (poll.expiresAt < now) {
      polls.delete(code);
      for (const session of sessions.values()) {
        session.pollsCreated = session.pollsCreated.filter(c => c !== code);
      }
    }
  }
}

setInterval(cleanupExpiredPolls, 5 * 60 * 1000);

export function generateCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function generateUniqueCode(): string {
  let code = generateCode();
  while (polls.has(code)) {
    code = generateCode();
  }
  return code;
}
