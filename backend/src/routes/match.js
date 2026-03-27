const express = require("express");
const { models } = require("../db");
const { auth } = require("../middleware/auth");
const {
  ACTIVE_LIKE_STATUSES,
  ensureMatch,
  emitMatch
} = require("../services/verification-workflow");

const router = express.Router();

const isPhotoVerified = (user) => !!user?.verified_photo;

router.post("/like", auth, async (req, res) => {
  const { userId, action } = req.body || {};
  if (!userId || !action) {
    return res.status(400).json({ error: "userId and action required" });
  }
  if (!["like", "dislike"].includes(action)) {
    return res.status(400).json({ error: "Invalid action" });
  }

  const me = await models.User.findById(req.user.id);
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
    _id: userId,
    verified: true,
    verified_photo: true,
    suspended: { $ne: true }
  });
  if (!target) {
    return res.status(404).json({ error: "User not found" });
  }
  if (me.gender && target.gender && me.gender === target.gender) {
    return res.status(403).json({ error: "Same gender likes are not allowed" });
  }

  const blocked = await models.Block.findOne({
    $or: [
      { blocker_id: req.user.id, blocked_id: userId },
      { blocker_id: userId, blocked_id: req.user.id }
    ]
  });
  if (blocked) {
    return res.status(403).json({ error: "User is blocked" });
  }

  await models.Like.findOneAndUpdate(
    { from_user_id: req.user.id, to_user_id: userId },
    {
      $set: { status: action },
      $setOnInsert: {
        from_user_id: req.user.id,
        to_user_id: userId,
        created_at: new Date()
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  let match = null;
  if (action === "like") {
    const reciprocal = await models.Like.findOne({
      from_user_id: userId,
      to_user_id: req.user.id,
      status: { $in: ACTIVE_LIKE_STATUSES }
    });

    if (reciprocal) {
      match = await ensureMatch(req.user.id, userId);
      emitMatch(req.app, req.user.id, userId, match);
    }
  }

  return res.json({ message: "Recorded", match, pending_verification: false });
});

router.post("/superlike", auth, async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: "userId required" });
  }

  const me = await models.User.findById(req.user.id);
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
    _id: userId,
    verified: true,
    verified_photo: true,
    suspended: { $ne: true }
  });
  if (!target) {
    return res.status(404).json({ error: "User not found" });
  }
  if (me.gender && target.gender && me.gender === target.gender) {
    return res.status(403).json({ error: "Same gender likes are not allowed" });
  }

  const blocked = await models.Block.findOne({
    $or: [
      { blocker_id: req.user.id, blocked_id: userId },
      { blocker_id: userId, blocked_id: req.user.id }
    ]
  });
  if (blocked) {
    return res.status(403).json({ error: "User is blocked" });
  }

  await models.Like.findOneAndUpdate(
    { from_user_id: req.user.id, to_user_id: userId },
    {
      $set: { status: "superlike" },
      $setOnInsert: {
        from_user_id: req.user.id,
        to_user_id: userId,
        created_at: new Date()
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await models.Superlike.findOneAndUpdate(
    { from_user_id: req.user.id, to_user_id: userId },
    {
      $setOnInsert: {
        from_user_id: req.user.id,
        to_user_id: userId,
        created_at: new Date()
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const reciprocal = await models.Like.findOne({
    from_user_id: userId,
    to_user_id: req.user.id,
    status: { $in: ACTIVE_LIKE_STATUSES }
  });

  let match = null;
  if (reciprocal) {
    match = await ensureMatch(req.user.id, userId);
    emitMatch(req.app, req.user.id, userId, match);
  }

  return res.json({ message: "Superlike sent", match, pending_verification: false });
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

  await models.User.updateOne({ _id: req.user.id }, { boost_ends_at: endsAt });

  return res.json({ message: "Boost activated", ends_at: endsAt.toISOString() });
});

router.get("/list", auth, async (req, res) => {
  const matches = await models.Match.find({
    $or: [{ user1_id: req.user.id }, { user2_id: req.user.id }]
  }).sort({ created_at: -1 }).lean();

  const payload = await Promise.all(matches.map(async (match) => {
    const otherId = String(match.user1_id) === String(req.user.id) ? match.user2_id : match.user1_id;
    const user = await models.User.findById(otherId).select("name gender location birthdate photos").lean();
    const lastMessage = await models.Message.findOne({ match_id: match._id })
      .sort({ created_at: -1 })
      .select("created_at")
      .lean();
    const unreadCount = await models.Message.countDocuments({
      match_id: match._id,
      to_user_id: req.user.id,
      read_at: null
    });
    return {
      id: match._id,
      user: user ? { ...user, id: user._id, photos: user.photos || [] } : null,
      created_at: match.created_at,
      last_message_at: lastMessage?.created_at || match.created_at,
      has_messages: !!lastMessage,
      unread_count: unreadCount
    };
  }));

  const newMatches = payload
    .filter((m) => !m.has_messages)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const conversations = payload
    .filter((m) => m.has_messages)
    .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));

  return res.json([...newMatches, ...conversations]);
});

router.get("/likes", auth, async (req, res) => {
  const me = await models.User.findById(req.user.id).select("premium").lean();
  if (!me) {
    return res.status(404).json({ error: "User not found" });
  }
  if (!me.premium) {
    return res.status(403).json({
      error: "Premium required to see who liked you",
      premium_required: true
    });
  }

  const likes = await models.Like.find({
    to_user_id: req.user.id,
    status: { $in: ACTIVE_LIKE_STATUSES }
  }).lean();

  const users = await Promise.all(likes.map(async (row) => {
    const user = await models.User.findById(row.from_user_id).select("name gender location birthdate photos").lean();
    return user ? { ...user, id: user._id, photos: user.photos || [] } : null;
  }));

  return res.json(users.filter(Boolean));
});

router.get("/liked-me", auth, async (req, res) => {
  const me = await models.User.findById(req.user.id).select("premium").lean();
  if (!me) {
    return res.status(404).json({ error: "User not found" });
  }
  if (!me.premium) {
    return res.status(403).json({
      error: "Premium required to see who liked you",
      premium_required: true
    });
  }

  const likes = await models.Like.find({
    to_user_id: req.user.id,
    status: { $in: ACTIVE_LIKE_STATUSES }
  }).lean();

  const myLikes = await models.Like.find({ from_user_id: req.user.id }).select("to_user_id").lean();
  const myLikeSet = new Set(myLikes.map((l) => String(l.to_user_id)));

  const users = await Promise.all(likes.map(async (row) => {
    if (myLikeSet.has(String(row.from_user_id))) return null;
    const hasMatch = await models.Match.findOne({
      $or: [
        { user1_id: req.user.id, user2_id: row.from_user_id },
        { user1_id: row.from_user_id, user2_id: req.user.id }
      ]
    }).lean();
    if (hasMatch) return null;

    const user = await models.User.findById(row.from_user_id).select("name gender location birthdate photos verified_photo").lean();
    if (!user) return null;
    return {
      id: user._id,
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
