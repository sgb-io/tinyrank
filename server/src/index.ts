import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import rateLimit from "express-rate-limit";
import { doubleCsrf } from "csrf-csrf";
import { sessionMiddleware } from "./session";
import { pollsRouter } from "./routes/polls";
import { eventsRouter } from "./routes/events";
import { loadState, persistState } from "./persist";

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === "production";

if (isProd) {
  app.set("trust proxy", 1);
}

app.use(cookieParser());
app.use(express.json());
app.use(sessionMiddleware);

// CSRF protection using the Double Submit Cookie pattern.
// GET /api/csrf-token returns a token the client must include in the
// X-CSRF-Token header for all state-changing requests.
const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET ?? "tinyrank-dev-csrf-secret",
  getSessionIdentifier: (req) => (req as express.Request).session?.id ?? "",
  cookieName: "tinyrank_csrf",
  cookieOptions: { sameSite: "lax", httpOnly: true, secure: isProd },
  getCsrfTokenFromRequest: (req) =>
    (req as express.Request).headers["x-csrf-token"] as string,
});

app.get("/api/csrf-token", (req, res) => {
  const token = generateCsrfToken(req, res);
  res.json({ csrfToken: token });
});

app.use("/api", doubleCsrfProtection);
app.use("/api", pollsRouter);
app.use("/api", eventsRouter);

// Handle CSRF validation errors gracefully
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (err.name === "ForbiddenError" || err.message === "invalid csrf token") {
      res.status(403).json({ error: "Invalid or missing CSRF token" });
      return;
    }
    next(err);
  },
);

// Rate limiter for the production static file catchall route
const staticLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

if (process.env.NODE_ENV === "production") {
  const clientDist = path.join(__dirname, "../../client/dist");
  app.use(staticLimiter);
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

loadState();

// Persist state on graceful shutdown so in-flight data is not lost.
function shutdown() {
  persistState();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

app.listen(PORT, () => {
  console.log(`TinyRank server running on port ${PORT}`);
});
