import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { polls, generateUniqueCode, MAX_POLLS_PER_USER, MAX_GLOBAL_POLLS, POLL_TTL } from '../store';
import { broadcastPollUpdate } from './events';
import { Poll, PollItem } from '../types';

export const pollsRouter = Router();

// GET /api/session - get current session
pollsRouter.get('/session', (req: Request, res: Response) => {
  res.json({
    id: req.session.id,
    username: req.session.username,
    pollsCreated: req.session.pollsCreated,
  });
});

// PATCH /api/session - update session (set username)
pollsRouter.patch('/session', (req: Request, res: Response) => {
  const { username } = req.body;
  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    res.status(400).json({ error: 'Username required' });
    return;
  }
  req.session.username = username.trim().slice(0, 32);
  res.json({ username: req.session.username });
});

// POST /api/polls - create new poll
pollsRouter.post('/polls', (req: Request, res: Response) => {
  if (polls.size >= MAX_GLOBAL_POLLS) {
    res.status(503).json({ error: 'Server is at capacity. Please try again later.' });
    return;
  }

  if (req.session.pollsCreated.length >= MAX_POLLS_PER_USER) {
    res.status(403).json({ error: `You can only create up to ${MAX_POLLS_PER_USER} polls.` });
    return;
  }

  const { title, items } = req.body;
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    res.status(400).json({ error: 'Title required' });
    return;
  }
  if (!Array.isArray(items) || items.length < 1) {
    res.status(400).json({ error: 'At least 1 item required' });
    return;
  }

  const code = generateUniqueCode();
  const now = Date.now();

  const pollItems: PollItem[] = items.map((text: string, index: number) => ({
    id: uuidv4(),
    text: String(text).trim().slice(0, 200),
    upvotes: [],
    downvotes: [],
    addedBy: req.session.id,
    order: index,
  }));

  const poll: Poll = {
    code,
    title: title.trim().slice(0, 100),
    items: pollItems,
    ownerId: req.session.id,
    createdAt: now,
    expiresAt: now + POLL_TTL,
  };

  polls.set(code, poll);
  req.session.pollsCreated.push(code);

  res.status(201).json({ code, poll });
});

// GET /api/polls/:code - get poll
pollsRouter.get('/polls/:code', (req: Request, res: Response) => {
  const code = req.params.code.toLowerCase();
  const poll = polls.get(code);
  if (!poll) {
    res.status(404).json({ error: 'Poll not found or expired' });
    return;
  }
  res.json({ poll, isOwner: poll.ownerId === req.session.id });
});

// PATCH /api/polls/:code - update poll (owner only: rename title)
pollsRouter.patch('/polls/:code', (req: Request, res: Response) => {
  const code = req.params.code.toLowerCase();
  const poll = polls.get(code);
  if (!poll) {
    res.status(404).json({ error: 'Poll not found' });
    return;
  }
  if (poll.ownerId !== req.session.id) {
    res.status(403).json({ error: 'Not the poll owner' });
    return;
  }
  const { title } = req.body;
  if (title && typeof title === 'string') {
    poll.title = title.trim().slice(0, 100);
  }
  broadcastPollUpdate(code);
  res.json({ poll });
});

// DELETE /api/polls/:code - delete poll (owner only)
pollsRouter.delete('/polls/:code', (req: Request, res: Response) => {
  const code = req.params.code.toLowerCase();
  const poll = polls.get(code);
  if (!poll) {
    res.status(404).json({ error: 'Poll not found' });
    return;
  }
  if (poll.ownerId !== req.session.id) {
    res.status(403).json({ error: 'Not the poll owner' });
    return;
  }
  polls.delete(code);
  req.session.pollsCreated = req.session.pollsCreated.filter(c => c !== code);
  res.json({ success: true });
});

// PATCH /api/polls/:code/items - reorder items (owner only)
pollsRouter.patch('/polls/:code/items', (req: Request, res: Response) => {
  const code = req.params.code.toLowerCase();
  const poll = polls.get(code);
  if (!poll) {
    res.status(404).json({ error: 'Poll not found' });
    return;
  }
  if (poll.ownerId !== req.session.id) {
    res.status(403).json({ error: 'Not the poll owner' });
    return;
  }
  const { order } = req.body;
  if (!Array.isArray(order)) {
    res.status(400).json({ error: 'order must be array of item IDs' });
    return;
  }
  order.forEach((id: string, index: number) => {
    const item = poll.items.find(i => i.id === id);
    if (item) item.order = index;
  });
  broadcastPollUpdate(code);
  res.json({ poll });
});

// POST /api/polls/:code/items - add item
pollsRouter.post('/polls/:code/items', (req: Request, res: Response) => {
  const code = req.params.code.toLowerCase();
  const poll = polls.get(code);
  if (!poll) {
    res.status(404).json({ error: 'Poll not found' });
    return;
  }
  const { text } = req.body;
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    res.status(400).json({ error: 'Item text required' });
    return;
  }
  const item: PollItem = {
    id: uuidv4(),
    text: text.trim().slice(0, 200),
    upvotes: [],
    downvotes: [],
    addedBy: req.session.id,
    order: poll.items.length,
  };
  poll.items.push(item);
  broadcastPollUpdate(code);
  res.status(201).json({ item });
});

// DELETE /api/polls/:code/items/:itemId - delete item (owner only)
pollsRouter.delete('/polls/:code/items/:itemId', (req: Request, res: Response) => {
  const code = req.params.code.toLowerCase();
  const poll = polls.get(code);
  if (!poll) {
    res.status(404).json({ error: 'Poll not found' });
    return;
  }
  if (poll.ownerId !== req.session.id) {
    res.status(403).json({ error: 'Not the poll owner' });
    return;
  }
  const itemId = req.params.itemId;
  const idx = poll.items.findIndex(i => i.id === itemId);
  if (idx === -1) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }
  poll.items.splice(idx, 1);
  broadcastPollUpdate(code);
  res.json({ success: true });
});

// POST /api/polls/:code/items/:itemId/vote - vote on item
pollsRouter.post('/polls/:code/items/:itemId/vote', (req: Request, res: Response) => {
  const code = req.params.code.toLowerCase();
  const poll = polls.get(code);
  if (!poll) {
    res.status(404).json({ error: 'Poll not found' });
    return;
  }

  const username = req.session.username;
  if (!username) {
    res.status(400).json({ error: 'Must set username before voting' });
    return;
  }

  const item = poll.items.find(i => i.id === req.params.itemId);
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  const { vote } = req.body; // 'up', 'down', or null to remove
  const userId = req.session.id;
  const voteRecord = { userId, username, avatarSeed: username };

  item.upvotes = item.upvotes.filter(v => v.userId !== userId);
  item.downvotes = item.downvotes.filter(v => v.userId !== userId);

  if (vote === 'up') {
    item.upvotes.push(voteRecord);
  } else if (vote === 'down') {
    item.downvotes.push(voteRecord);
  }

  broadcastPollUpdate(code);
  res.json({ item });
});
