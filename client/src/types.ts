export type Tier = "S" | "A" | "B" | "C" | "D" | "E";

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
  polls: { code: string; title: string }[];
}

export function getTier(score: number): Tier {
  if (score >= 1) return "S";
  if (score >= 0) return "A";
  if (score >= -3) return "B";
  if (score >= -6) return "C";
  if (score >= -9) return "D";
  return "E";
}
