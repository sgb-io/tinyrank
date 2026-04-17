import fs from "fs";
import path from "path";
import { polls, sessions } from "./store";
import { Poll, Session } from "./types";

const RAW_STATE_FILE = process.env.STATE_FILE ?? null;
const STATE_FILE = RAW_STATE_FILE ? path.resolve(RAW_STATE_FILE) : null;

const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days — mirrors session.ts

interface PersistedState {
  polls: [string, Poll][];
  sessions: [string, Session][];
  savedAt: number;
}

/**
 * Loads persisted polls and sessions from STATE_FILE into the in-memory store.
 * Expired polls and expired sessions are silently skipped.
 * No-op when STATE_FILE is not configured.
 */
export function loadState(): void {
  if (!STATE_FILE) return;
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf8");
    const data: PersistedState = JSON.parse(raw);
    const now = Date.now();
    let loadedPolls = 0;
    for (const [code, poll] of data.polls ?? []) {
      if (poll.expiresAt > now) {
        polls.set(code, poll);
        loadedPolls++;
      }
    }
    let loadedSessions = 0;
    for (const [id, session] of data.sessions ?? []) {
      if (session.createdAt + SESSION_TTL > now) {
        sessions.set(id, session);
        loadedSessions++;
      }
    }
    console.log(
      `[persist] Loaded state from ${STATE_FILE} ` +
        `(${loadedPolls} polls, ${loadedSessions} sessions)`,
    );
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("[persist] Failed to load state:", err);
    }
  }
}

/**
 * Writes the current in-memory polls and sessions to STATE_FILE atomically.
 * No-op when STATE_FILE is not configured.
 */
export function persistState(): void {
  if (!STATE_FILE) return;
  try {
    const dir = path.dirname(STATE_FILE);
    fs.mkdirSync(dir, { recursive: true });
    const data: PersistedState = {
      polls: [...polls.entries()],
      sessions: [...sessions.entries()],
      savedAt: Date.now(),
    };
    const tmp = STATE_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data), "utf8");
    fs.renameSync(tmp, STATE_FILE);
  } catch (err) {
    console.error("[persist] Failed to save state:", err);
  }
}

// Periodically save state to disk so that a crash loses at most 60 s of data.
if (STATE_FILE) {
  setInterval(persistState, 60 * 1000);
}
