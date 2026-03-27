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

app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);
app.use("/match", matchRoutes);
app.use("/messages", messageRoutes);
app.use("/moderation", moderationRoutes);
app.use("/admin", adminRoutes);

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
