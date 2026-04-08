const express = require("express");
const { models, Op } = require("../db");
const { auth } = require("../middleware/auth");
const {
  ACTIVE_LIKE_STATUSES,
  ensureMatch,
  emitMatch
} = require("../services/verification-workflow");

const router = express.Router();

const isPhotoVerified = (user) => !!user?.verified_photo;

const upsertLike = async (fromUserId, toUserId, status) => {
  const existing = await models.Like.findOne({
    where: {
      from_user_id: fromUserId,
      to_user_id: toUserId
    }
  });

  if (existing) {
    existing.status = status;
    await existing.save();
    return existing;
  }

  return models.Like.create({
    from_user_id: fromUserId,
    to_user_id: toUserId,
    status,
    created_at: new Date()
  });
};

router.post("/like", auth, async (req, res) => {
  const { userId, action } = req.body || {};
  if (!userId || !action) {
    return res.status(400).json({ error: "userId and action required" });
  }
  if (!["like", "dislike"].includes(action)) {
    return res.status(400).json({ error: "Invalid action" });
  }

  const me = await models.User.findByPk(req.user.id);
  if (!me) {
    return res.status(404).json({ error: "User not found" });
  }
  if (!isPhotoVerified(me)) {
    return res.status(403).json({
      error: "Profile photo verification required",
      verification_required: true
    });
  }

  const target = await models.User.findOne({
    where: {
      id: userId,
      verified: true,
      verified_photo: true,
      suspended: { [Op.ne]: true }
    }
  });
  if (!target) {
    return res.status(404).json({ error: "User not found" });
  }
  if (me.gender && target.gender && me.gender === target.gender) {
    return res.status(403).json({ error: "Same gender likes are not allowed" });
  }

  const blocked = await models.Block.findOne({
    where: {
      [Op.or]: [
        { blocker_id: req.user.id, blocked_id: userId },
        { blocker_id: userId, blocked_id: req.user.id }
      ]
    }
  });
  if (blocked) {
    return res.status(403).json({ error: "User is blocked" });
  }

  await upsertLike(req.user.id, userId, action);

  let match = null;
  if (action === "like") {
    const reciprocal = await models.Like.findOne({
      where: {
        from_user_id: userId,
        to_user_id: req.user.id,
        status: { [Op.in]: ACTIVE_LIKE_STATUSES }
      }
    });

    if (reciprocal) {
      match = await ensureMatch(req.user.id, userId);
      emitMatch(req.app, req.user.id, userId, match);
    }
  }

  return res.json({
    message: "Recorded",
    match: match ? (match.toJSON ? match.toJSON() : match) : null,
    pending_verification: false
  });
});

router.post("/superlike", auth, async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: "userId required" });
  }

  const me = await models.User.findByPk(req.user.id);
  if (!me) {
    return res.status(404).json({ error: "User not found" });
  }
  if (!isPhotoVerified(me)) {
    return res.status(403).json({
      error: "Profile photo verification required",
      verification_required: true
    });
  }

  const target = await models.User.findOne({
    where: {
      id: userId,
      verified: true,
      verified_photo: true,
      suspended: { [Op.ne]: true }
    }
  });
  if (!target) {
    return res.status(404).json({ error: "User not found" });
  }
  if (me.gender && target.gender && me.gender === target.gender) {
    return res.status(403).json({ error: "Same gender likes are not allowed" });
  }

  const blocked = await models.Block.findOne({
    where: {
      [Op.or]: [
        { blocker_id: req.user.id, blocked_id: userId },
        { blocker_id: userId, blocked_id: req.user.id }
      ]
    }
  });
  if (blocked) {
    return res.status(403).json({ error: "User is blocked" });
  }

  await upsertLike(req.user.id, userId, "superlike");

  await models.Superlike.findOrCreate({
    where: {
      from_user_id: req.user.id,
      to_user_id: userId
    },
    defaults: {
      from_user_id: req.user.id,
      to_user_id: userId,
      created_at: new Date()
    }
  });

  const reciprocal = await models.Like.findOne({
    where: {
      from_user_id: userId,
      to_user_id: req.user.id,
      status: { [Op.in]: ACTIVE_LIKE_STATUSES }
    }
  });

  let match = null;
  if (reciprocal) {
    match = await ensureMatch(req.user.id, userId);
    emitMatch(req.app, req.user.id, userId, match);
  }

  return res.json({
    message: "Superlike sent",
    match: match ? (match.toJSON ? match.toJSON() : match) : null,
    pending_verification: false
  });
});

router.post("/boost", auth, async (req, res) => {
  const durationMinutes = Number(req.body?.minutes || 30);
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);

  await models.Boost.create({
    user_id: req.user.id,
    starts_at: startsAt,
    ends_at: endsAt
  });

  await models.User.update(
    { boost_ends_at: endsAt },
    { where: { id: req.user.id } }
  );

  return res.json({ message: "Boost activated", ends_at: endsAt.toISOString() });
});

router.get("/list", auth, async (req, res) => {
  const matches = await models.Match.findAll({
    where: {
      [Op.or]: [{ user1_id: req.user.id }, { user2_id: req.user.id }]
    },
    order: [["created_at", "DESC"]]
  });

  const payload = await Promise.all(matches.map(async (match) => {
    const otherId = String(match.user1_id) === String(req.user.id) ? match.user2_id : match.user1_id;
    const user = await models.User.findByPk(otherId, {
      attributes: ["id", "name", "gender", "location", "birthdate", "photos"]
    });
    const lastMessage = await models.Message.findOne({
      where: { match_id: match.id },
      order: [["created_at", "DESC"]],
      attributes: ["created_at"]
    });
    const unreadCount = await models.Message.count({
      where: {
        match_id: match.id,
        to_user_id: req.user.id,
        read_at: null
      }
    });

    const userPayload = user ? user.toJSON() : null;
    return {
      id: match.id,
      _id: match.id,
      user: userPayload ? { ...userPayload, id: userPayload.id, photos: userPayload.photos || [] } : null,
      created_at: match.created_at,
      last_message_at: lastMessage?.created_at || match.created_at,
      has_messages: !!lastMessage,
      unread_count: unreadCount
    };
  }));

  const newMatches = payload
    .filter((item) => !item.has_messages)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const conversations = payload
    .filter((item) => item.has_messages)
    .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));

  return res.json([...newMatches, ...conversations]);
});

router.get("/likes", auth, async (req, res) => {
  const me = await models.User.findByPk(req.user.id, {
    attributes: ["id", "premium"]
  });
  if (!me) {
    return res.status(404).json({ error: "User not found" });
  }
  if (!me.premium) {
    return res.status(403).json({
      error: "Premium required to see who liked you",
      premium_required: true
    });
  }

  const likes = await models.Like.findAll({
    where: {
      to_user_id: req.user.id,
      status: { [Op.in]: ACTIVE_LIKE_STATUSES }
    }
  });

  const users = await Promise.all(likes.map(async (row) => {
    const user = await models.User.findByPk(row.from_user_id, {
      attributes: ["id", "name", "gender", "location", "birthdate", "photos"]
    });
    return user ? { ...user.toJSON(), id: user.id, photos: user.photos || [] } : null;
  }));

  return res.json(users.filter(Boolean));
});

router.get("/liked-me", auth, async (req, res) => {
  const me = await models.User.findByPk(req.user.id, {
    attributes: ["id", "premium"]
  });
  if (!me) {
    return res.status(404).json({ error: "User not found" });
  }
  if (!me.premium) {
    return res.status(403).json({
      error: "Premium required to see who liked you",
      premium_required: true
    });
  }

  const likes = await models.Like.findAll({
    where: {
      to_user_id: req.user.id,
      status: { [Op.in]: ACTIVE_LIKE_STATUSES }
    }
  });

  const myLikes = await models.Like.findAll({
    where: { from_user_id: req.user.id },
    attributes: ["to_user_id"]
  });
  const myLikeSet = new Set(myLikes.map((row) => String(row.to_user_id)));

  const users = await Promise.all(likes.map(async (row) => {
    if (myLikeSet.has(String(row.from_user_id))) return null;
    const hasMatch = await models.Match.findOne({
      where: {
        [Op.or]: [
          { user1_id: req.user.id, user2_id: row.from_user_id },
          { user1_id: row.from_user_id, user2_id: req.user.id }
        ]
      }
    });
    if (hasMatch) return null;

    const user = await models.User.findByPk(row.from_user_id, {
      attributes: ["id", "name", "gender", "location", "birthdate", "photos", "verified_photo"]
    });
    if (!user) return null;
    return {
      id: user.id,
      _id: user.id,
      name: user.name,
      gender: user.gender,
      location: user.location,
      birthdate: user.birthdate,
      photos: user.photos || [],
      verified_photo: !!user.verified_photo,
      like_type: row.status
    };
  }));

  return res.json(users.filter(Boolean));
});

module.exports = router;
