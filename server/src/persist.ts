import fs from "fs";
import path from "path";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  NoSuchKey,
} from "@aws-sdk/client-s3";
import { polls, sessions } from "./store";
import { Poll, Session } from "./types";

// ── File-based config ────────────────────────────────────────────────────────
const RAW_STATE_FILE = process.env.STATE_FILE ?? null;
const STATE_FILE = RAW_STATE_FILE ? path.resolve(RAW_STATE_FILE) : null;

// ── S3 / S3-compatible config ────────────────────────────────────────────────
const S3_BUCKET = process.env.S3_BUCKET ?? null;
const S3_KEY = process.env.S3_KEY ?? "tinyrank-state.json";
const S3_REGION = process.env.S3_REGION ?? "us-east-1";
const S3_ENDPOINT = process.env.S3_ENDPOINT ?? undefined;
const S3_FORCE_PATH_STYLE =
  process.env.S3_FORCE_PATH_STYLE === "true" ? true : undefined;

// ── Active persistence mode ──────────────────────────────────────────────────
// S3 takes precedence if both are configured.
const MODE: "s3" | "file" | "none" = S3_BUCKET
  ? "s3"
  : STATE_FILE
    ? "file"
    : "none";

const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days — mirrors session.ts

interface PersistedState {
  polls: [string, Poll][];
  sessions: [string, Session][];
  savedAt: number;
}

// ── S3 client (created once when S3 mode is active) ─────────────────────────
let _s3Client: S3Client | null = null;
function getS3Client(): S3Client {
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: S3_REGION,
      ...(S3_ENDPOINT ? { endpoint: S3_ENDPOINT } : {}),
      ...(S3_FORCE_PATH_STYLE ? { forcePathStyle: true } : {}),
    });
  }
  return _s3Client;
}

// ── Shared helpers ───────────────────────────────────────────────────────────
function restoreFromData(data: PersistedState, source: string): void {
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
    `[persist] Loaded state from ${source} ` +
      `(${loadedPolls} polls, ${loadedSessions} sessions)`,
  );
}

function buildStateData(): PersistedState {
  return {
    polls: [...polls.entries()],
    sessions: [...sessions.entries()],
    savedAt: Date.now(),
  };
}

// ── S3 backend ───────────────────────────────────────────────────────────────
async function loadFromS3(): Promise<void> {
  const s3Location = `s3://${S3_BUCKET}/${S3_KEY}`;
  try {
    const response = await getS3Client().send(
      new GetObjectCommand({ Bucket: S3_BUCKET!, Key: S3_KEY }),
    );
    const body = (await response.Body?.transformToString("utf8")) ?? "{}";
    const data: PersistedState = JSON.parse(body);
    restoreFromData(data, s3Location);
  } catch (err: unknown) {
    if (err instanceof NoSuchKey) {
      return; // First run — object does not exist yet
    }
    throw err;
  }
}

async function saveToS3(): Promise<void> {
  const data = buildStateData();
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: S3_BUCKET!,
      Key: S3_KEY,
      Body: JSON.stringify(data),
      ContentType: "application/json",
    }),
  );
}

// ── File backend ─────────────────────────────────────────────────────────────
function loadFromFile(): void {
  try {
    const raw = fs.readFileSync(STATE_FILE!, "utf8");
    const data: PersistedState = JSON.parse(raw);
    restoreFromData(data, STATE_FILE!);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("[persist] Failed to load state:", err);
    }
  }
}

// Synchronous write so that the shutdown flush completes before process.exit.
function saveToFile(): void {
  try {
    const dir = path.dirname(STATE_FILE!);
    fs.mkdirSync(dir, { recursive: true });
    const data = buildStateData();
    const tmp = STATE_FILE! + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data), "utf8");
    fs.renameSync(tmp, STATE_FILE!);
  } catch (err) {
    console.error("[persist] Failed to save state:", err);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Loads persisted polls and sessions into the in-memory store.
 * Expired polls and sessions are silently skipped.
 * No-op when neither STATE_FILE nor S3_BUCKET is configured.
 */
export async function loadState(): Promise<void> {
  if (MODE === "none") return;
  if (MODE === "s3") {
    try {
      await loadFromS3();
    } catch (err) {
      console.error("[persist] Failed to load state from S3:", err);
    }
    return;
  }
  loadFromFile();
}

/**
 * Persists the current in-memory polls and sessions.
 * No-op when neither STATE_FILE nor S3_BUCKET is configured.
 */
export async function persistState(): Promise<void> {
  if (MODE === "none") return;
  if (MODE === "s3") {
    try {
      await saveToS3();
    } catch (err) {
      console.error("[persist] Failed to save state to S3:", err);
    }
    return;
  }
  saveToFile();
}

// Periodically save state so that a crash loses at most 60 s of data.
if (MODE !== "none") {
  setInterval(
    () =>
      persistState().catch((err) =>
        console.error("[persist] Periodic save failed:", err),
      ),
    60 * 1000,
  );
}
