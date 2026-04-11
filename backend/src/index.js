require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");
const { Server } = require("socket.io");
const { connectDB } = require("./db");

const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const matchRoutes = require("./routes/match");
const messageRoutes = require("./routes/message");
const moderationRoutes = require("./routes/moderation");
const adminRoutes = require("./routes/admin");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.set("io", io);

app.use(
  helmet({
    // This project serves an API (plus static `/uploads`). A restrictive CSP here can
    // break image/media loading when the frontend is served from the same origin.
    // The frontend (Vite / web host) should be responsible for any CSP.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120
  })
);

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/health", (req, res) => res.json({ status: "ok" }));

const MEDIA_PROXY_HOSTS = new Set([
  "images.pexels.com",
  "images.unsplash.com",
  "plus.unsplash.com",
  "source.unsplash.com"
]);

app.get("/media-proxy", async (req, res) => {
  const rawUrl = String(req.query?.url || "").trim();
  if (!rawUrl) {
    return res.status(400).json({ error: "Missing url" });
  }

  let target;
  try {
    target = new URL(rawUrl);
  } catch {
    return res.status(400).json({ error: "Invalid url" });
  }

  if (!["http:", "https:"].includes(target.protocol)) {
    return res.status(400).json({ error: "Invalid protocol" });
  }

  if (!MEDIA_PROXY_HOSTS.has(target.hostname)) {
    return res.status(403).json({ error: "Host not allowed" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const upstream = await fetch(target.toString(), {
      signal: controller.signal,
      redirect: "follow"
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: "Upstream fetch failed" });
    }

    const contentType = upstream.headers.get("content-type") || "";
    if (!/^image\//i.test(contentType)) {
      return res.status(415).json({ error: "Unsupported content type" });
    }

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");

    const buffer = Buffer.from(await upstream.arrayBuffer());
    return res.send(buffer);
  } catch (err) {
    const aborted = err?.name === "AbortError";
    return res.status(aborted ? 504 : 502).json({
      error: aborted ? "Upstream timeout" : "Upstream request failed"
    });
  } finally {
    clearTimeout(timeout);
  }
});

app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);
app.use("/match", matchRoutes);
app.use("/messages", messageRoutes);
app.use("/moderation", moderationRoutes);
app.use("/admin", adminRoutes);
// Backward-compatible alias for frontends that proxy admin calls via `/admin-api/*`.
app.use("/admin-api", adminRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found" }));

io.on("connection", (socket) => {
  socket.on("join", (userId) => {
    if (userId) socket.join(`user:${userId}`);
  });
});

const port = process.env.PORT || 4000;

const start = async () => {
  await connectDB();
  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`NDOLOLY API listening on ${port}`);
  });
};

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server", err);
  process.exit(1);
});
