export interface Session {
  id: string;
  username?: string;
  pollsCreated: string[]; // poll codes
  createdAt: number;
}

export interface VoteRecord {
  userId: string;
  username: string;
  avatarSeed: string;
}

export interface PollItem {
  id: string;
  text: string;
  itemType: "text" | "image";
  upvotes: VoteRecord[];
  downvotes: VoteRecord[];
  addedBy: string; // userId
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

export type Tier = "S" | "A" | "B" | "C" | "D" | "E";

export function getTier(score: number): Tier {
  if (score >= 2) return "S";
  if (score >= 1) return "A";
  if (score >= 0) return "B";
  if (score >= -2) return "C";
  if (score >= -4) return "D";
  return "E";
}
