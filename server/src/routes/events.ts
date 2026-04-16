import { Router, Request, Response } from 'express';
import { polls } from '../store';

export const eventsRouter = Router();
export const sseClients = new Map<string, Set<Response>>();

export function broadcastPollUpdate(code: string): void {
  const poll = polls.get(code);
  if (!poll) return;
  const clients = sseClients.get(code);
  if (!clients || clients.size === 0) return;
  
  const data = JSON.stringify(poll);
  for (const client of clients) {
    client.write(`data: ${data}\n\n`);
  }
}

eventsRouter.get('/poll/:code/events', (req: Request, res: Response) => {
  const code = req.params.code.toLowerCase();
  const poll = polls.get(code);
  
  if (!poll) {
    res.status(404).json({ error: 'Poll not found' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify(poll)}\n\n`);

  if (!sseClients.has(code)) {
    sseClients.set(code, new Set());
  }
  sseClients.get(code)!.add(res);

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.get(code)?.delete(res);
  });
});
