const express = require("express");
const multer = require("multer");
const path = require("path");
const { models, Op } = require("../db");
const { auth } = require("../middleware/auth");

const router = express.Router();

const uploadsDir = path.join(__dirname, "..", "..", "uploads");

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const safeExt = ext && ext.length <= 8 ? ext.toLowerCase() : "";
    const base = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${base}${safeExt}`);
  }
});

const upload = multer({ storage });

const getMatch = (matchId, userId) => {
  return models.Match.findOne({
    where: {
      id: matchId,
      [Op.or]: [{ user1_id: userId }, { user2_id: userId }]
    }
  });
};

const toMessagePayload = (message) => {
  const raw = message?.toJSON ? message.toJSON() : message;
  if (!raw) return raw;
  return {
    ...raw,
    _id: raw.id,
    status: raw.read_at ? "read" : raw.delivered_at ? "received" : "sent"
  };
};

const emitMessageStatus = (req, message) => {
  const io = req.app.get("io");
  if (!io || !message) return;

  const payload = {
    message_id: message.id,
    match_id: message.match_id,
    delivered_at: message.delivered_at,
    read_at: message.read_at,
    listened_at: message.listened_at,
    status: message.read_at ? "read" : message.delivered_at ? "received" : "sent"
  };

  io.to(`user:${message.from_user_id}`).emit("message:status", payload);
  io.to(`user:${message.to_user_id}`).emit("message:status", payload);
};

router.get("/:matchId", auth, async (req, res) => {
  const matchId = req.params.matchId;
  const match = await getMatch(matchId, req.user.id);
  if (!match) return res.status(404).json({ error: "Match not found" });

  const messages = await models.Message.findAll({
    where: { match_id: matchId },
    order: [["created_at", "ASC"]]
  });

  return res.json(messages.map(toMessagePayload));
});

router.post("/:matchId", auth, async (req, res) => {
  const matchId = req.params.matchId;
  const match = await getMatch(matchId, req.user.id);
  if (!match) return res.status(404).json({ error: "Match not found" });

  const { content } = req.body || {};
  if (!content) return res.status(400).json({ error: "Content required" });

  const toUserId = String(match.user1_id) === String(req.user.id) ? match.user2_id : match.user1_id;

  const message = await models.Message.create({
    match_id: matchId,
    from_user_id: req.user.id,
    to_user_id: toUserId,
    type: "text",
    content
  });

  const io = req.app.get("io");
  if (io) {
    const payload = toMessagePayload(message);
    io.to(`user:${req.user.id}`).emit("message:new", payload);
    io.to(`user:${toUserId}`).emit("message:new", payload);
  }

  return res.status(201).json(toMessagePayload(message));
});

router.post("/:matchId/image", auth, upload.single("image"), async (req, res) => {
  const matchId = req.params.matchId;
  const match = await getMatch(matchId, req.user.id);
  if (!match) return res.status(404).json({ error: "Match not found" });
  if (!req.file) return res.status(400).json({ error: "No file" });

  const toUserId = String(match.user1_id) === String(req.user.id) ? match.user2_id : match.user1_id;
  const urlPath = `/uploads/${req.file.filename}`;

  const message = await models.Message.create({
    match_id: matchId,
    from_user_id: req.user.id,
    to_user_id: toUserId,
    type: "image",
    media_url: urlPath
  });

  const io = req.app.get("io");
  if (io) {
    const payload = toMessagePayload(message);
    io.to(`user:${req.user.id}`).emit("message:new", payload);
    io.to(`user:${toUserId}`).emit("message:new", payload);
  }

  return res.status(201).json(toMessagePayload(message));
});

router.post("/:matchId/audio", auth, upload.any(), async (req, res) => {
  try {
    const matchId = req.params.matchId;
    const match = await getMatch(matchId, req.user.id);
    if (!match) return res.status(404).json({ error: "Match not found" });

    const file = req.file || (Array.isArray(req.files) ? req.files[0] : null);
    if (!file) {
      return res.status(400).json({
        error: "No file",
        detail: {
          content_type: req.headers["content-type"] || null,
          body_keys: Object.keys(req.body || {}),
          files_count: Array.isArray(req.files) ? req.files.length : 0
        }
      });
    }

    const toUserId = String(match.user1_id) === String(req.user.id) ? match.user2_id : match.user1_id;
    const urlPath = `/uploads/${file.filename}`;

    const message = await models.Message.create({
      match_id: matchId,
      from_user_id: req.user.id,
      to_user_id: toUserId,
      type: "audio",
      media_url: urlPath
    });

    const io = req.app.get("io");
    if (io) {
      const payload = toMessagePayload(message);
      io.to(`user:${req.user.id}`).emit("message:new", payload);
      io.to(`user:${toUserId}`).emit("message:new", payload);
    }

    return res.status(201).json(toMessagePayload(message));
  } catch (err) {
    return res.status(500).json({ error: "Audio upload failed", detail: err?.message || String(err) });
  }
});

router.post("/:matchId/received", auth, async (req, res) => {
  const matchId = req.params.matchId;
  const match = await getMatch(matchId, req.user.id);
  if (!match) return res.status(404).json({ error: "Match not found" });

  const messageId = req.body?.messageId;
  const where = {
    match_id: matchId,
    to_user_id: req.user.id,
    delivered_at: null
  };
  if (messageId) where.id = messageId;

  const candidates = await models.Message.findAll({ where });
  if (!candidates.length) return res.json({ updated: 0 });

  const now = new Date();
  await Promise.all(
    candidates.map(async (message) => {
      message.delivered_at = message.delivered_at || now;
      await message.save();
      emitMessageStatus(req, message);
    })
  );

  return res.json({ updated: candidates.length });
});

router.post("/:matchId/read", auth, async (req, res) => {
  const matchId = req.params.matchId;
  const match = await getMatch(matchId, req.user.id);
  if (!match) return res.status(404).json({ error: "Match not found" });

  const messageId = req.body?.messageId;
  const where = {
    match_id: matchId,
    to_user_id: req.user.id,
    read_at: null
  };
  if (messageId) where.id = messageId;

  const candidates = await models.Message.findAll({ where });
  if (!candidates.length) return res.json({ updated: 0 });

  const now = new Date();
  await Promise.all(
    candidates.map(async (message) => {
      message.delivered_at = message.delivered_at || now;
      message.read_at = now;
      await message.save();
      emitMessageStatus(req, message);
    })
  );

  return res.json({ updated: candidates.length });
});

router.post("/:matchId/listened", auth, async (req, res) => {
  const matchId = req.params.matchId;
  const match = await getMatch(matchId, req.user.id);
  if (!match) return res.status(404).json({ error: "Match not found" });

  const messageId = req.body?.messageId;
  const where = {
    match_id: matchId,
    to_user_id: req.user.id,
    type: "audio",
    listened_at: null
  };
  if (messageId) where.id = messageId;

  const candidates = await models.Message.findAll({ where });
  if (!candidates.length) return res.json({ updated: 0 });

  const now = new Date();
  await Promise.all(
    candidates.map(async (message) => {
      message.listened_at = now;
      message.delivered_at = message.delivered_at || now;
      await message.save();
      emitMessageStatus(req, message);
    })
  );

  return res.json({ updated: candidates.length });
});

module.exports = router;
