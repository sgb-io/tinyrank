export type Tier = 'S' | 'A' | 'B' | 'C' | 'D' | 'E';

export interface VoteRecord {
  userId: string;
  username: string;
  avatarSeed: string;
}

export interface PollItem {
  id: string;
  text: string;
  upvotes: VoteRecord[];
  downvotes: VoteRecord[];
  addedBy: string;
  order: number;
}

export interface Poll {
  code: string;
  title: string;
  items: PollItem[];
  ownerId: string;
  createdAt: number;
  expiresAt: number;
}

export interface SessionInfo {
  id: string;
  username?: string;
  pollsCreated: string[];
}

export function getTier(score: number): Tier {
  if (score >= 8) return 'S';
  if (score >= 4) return 'A';
  if (score >= 1) return 'B';
  if (score === 0) return 'C';
  if (score >= -3) return 'D';
  return 'E';
}
