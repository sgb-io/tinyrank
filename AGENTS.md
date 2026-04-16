# TinyRank

Real-time collaborative polling/ranking app.

## Structure

- `server/` — Express + TypeScript API (port 3001). In-memory store, cookie-based sessions, CSRF via double-submit cookie (`csrf-csrf`).
- `client/` — React + TypeScript SPA via Vite (port 5173). Proxies `/api` to server in dev.

## Dev

```sh
npm run install:all
npm run dev:server   # starts nodemon on server/src/index.ts
npm run dev:client   # starts vite dev server
```

## Build

```sh
npm run build        # builds both server and client
```
