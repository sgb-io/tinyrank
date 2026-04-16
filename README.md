# TinyRank

A minimal, lightweight web application for live tier ranking polls.

Create a poll, share a short 6-character code, and watch participants rank items into tiers (S/A/B/C/D/E) in real time — no accounts required.

![TinyRank home page](https://github.com/user-attachments/assets/b9ec0dd9-b33e-4c37-bd87-3b4828446ea3)

## Features

- **Anonymous & ephemeral** — cookie-based sessions, no sign-up, polls auto-delete after 24 hours
- **Instant sharing** — 6-character codes (`/poll/giwkch`), case-insensitive
- **Live updates** — Server-Sent Events push every vote/item change to all viewers in real time
- **Auto-tiering** — items move between S/A/B/C/D/E tiers automatically based on vote score
- **Avatars** — deterministic SVG avatars generated from each participant's display name
- **Owner controls** — rename poll, delete items, delete poll

## Tech Stack

| Layer | Technology |
|---|---|
| Server | Node.js · TypeScript · Express |
| Client | React · TypeScript · Vite |
| Database | In-memory (no external dependency) |
| Real-time | Server-Sent Events (SSE) |

## Project Structure

```
tinyrank/
├── package.json          # Root scripts
├── server/               # Express API server
│   └── src/
│       ├── index.ts      # Entry point, middleware, CSRF, rate limiting
│       ├── types.ts      # Shared types (Poll, PollItem, Session, …)
│       ├── store.ts      # In-memory data store + TTL cleanup
│       ├── session.ts    # Cookie-based anonymous sessions
│       └── routes/
│           ├── polls.ts  # REST endpoints for polls, items, voting
│           └── events.ts # SSE endpoint for real-time updates
└── client/               # React SPA
    └── src/
        ├── App.tsx           # Client-side router
        ├── types.ts          # Shared types (mirrors server)
        ├── styles.css        # Dark theme + tier colours + animations
        ├── components/
        │   ├── HomePage.tsx      # Create / join poll
        │   ├── PollPage.tsx      # Poll view, SSE consumer, owner controls
        │   ├── TierList.tsx      # S–E tier rows with auto-grouping
        │   ├── PollItem.tsx      # Item card with vote buttons
        │   └── VoterAvatars.tsx  # Avatar stack + hover modal
        └── utils/
            ├── api.ts        # Fetch wrapper (auto CSRF header)
            └── avatar.ts     # Deterministic SVG avatar generator
```

## Development

### Prerequisites

- **Node.js** v18 or later
- **npm** v9 or later

### Install dependencies

```bash
# From the repo root — installs root, server, and client deps in one go
npm run install:all
```

Or install each workspace separately:

```bash
npm install
cd server && npm install
cd ../client && npm install
```

### Run in development mode

The server and client need to run in **two separate terminals**.

**Terminal 1 — API server** (port 3001):

```bash
cd server
npm run dev
```

**Terminal 2 — Vite dev server** (port 5173, proxies `/api` → `localhost:3001`):

```bash
cd client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

> The Vite dev server is configured to proxy all `/api` requests to the Express server, so CSRF cookies and session cookies work correctly across both ports.

### Environment variables (development)

No variables are required for local development. The following optional variables are available:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Port the Express server listens on |
| `CSRF_SECRET` | `tinyrank-dev-csrf-secret` | Secret used to sign CSRF tokens — **change this in production** |
| `NODE_ENV` | — | Set to `production` to serve the built client from the server |

## Production Build & Deployment

TinyRank is designed to run as a single Node.js process in production — the Express server builds and serves the React client as static files.

### 1. Build

```bash
# From the repo root
npm run build
```

This runs `tsc` in `server/` (outputs to `server/dist/`) and `vite build` in `client/` (outputs to `client/dist/`).

### 2. Set environment variables

```bash
export NODE_ENV=production
export PORT=3001                      # or whichever port your host exposes
export CSRF_SECRET=your-random-secret # generate with: openssl rand -hex 32
```

### 3. Start the server

```bash
cd server
npm start          # runs: node dist/index.js
```

The server will:
- Serve the React SPA from `client/dist/` for all non-API routes
- Handle all API and SSE requests under `/api/`

### Deploying to a cloud host

Because the only runtime dependency is **Node.js**, TinyRank deploys to any platform that runs Node:

**Railway / Render / Fly.io / similar PaaS**

1. Set the build command to `npm run install:all && npm run build`.
2. Set the start command to `cd server && npm start`.
3. Add `NODE_ENV=production` and `CSRF_SECRET=<secret>` as environment variables.
4. Expose the port defined by `PORT` (most platforms inject `PORT` automatically).

**Manual VPS / Docker**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm run install:all && npm run build
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
CMD ["node", "server/dist/index.js"]
```

### Important production notes

- **Data is in-memory.** All polls are lost on process restart. This is by design — polls only live for 24 hours.
- **Single instance only.** Because the store is in-memory, running multiple server instances will result in inconsistent state. Use a single-instance deployment.
- **Set `CSRF_SECRET`** to a long random string in production; the default is insecure.

## API Reference

All endpoints are prefixed with `/api`. State-changing requests (`POST`, `PATCH`, `DELETE`) require an `X-CSRF-Token` header obtained from `GET /api/csrf-token`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/csrf-token` | Get a CSRF token |
| `GET` | `/api/session` | Get current session |
| `PATCH` | `/api/session` | Set display name (`{ username }`) |
| `POST` | `/api/polls` | Create poll (`{ title, items[] }`) |
| `GET` | `/api/polls/:code` | Get poll + `isOwner` flag |
| `PATCH` | `/api/polls/:code` | Rename poll title (owner only) |
| `DELETE` | `/api/polls/:code` | Delete poll (owner only) |
| `POST` | `/api/polls/:code/items` | Add item (`{ text }`) |
| `DELETE` | `/api/polls/:code/items/:id` | Delete item (owner only) |
| `POST` | `/api/polls/:code/items/:id/vote` | Vote (`{ vote: "up"\|"down"\|null }`) |
| `GET` | `/api/poll/:code/events` | SSE stream of live poll updates |

## Tiering Logic

Items are assigned a tier automatically from their score (`upvotes − downvotes`):

| Tier | Score |
|---|---|
| S | ≥ 8 |
| A | 4 – 7 |
| B | 1 – 3 |
| C | 0 (default) |
| D | −1 to −3 |
| E | ≤ −4 |

## Limits

| Limit | Value |
|---|---|
| Polls per session | 10 |
| Global polls | 5,000 |
| Poll lifetime | 24 hours |
| Poll title length | 100 characters |
| Item text length | 200 characters |
| Display name length | 32 characters |
