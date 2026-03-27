const { models } = require("../db");

const ACTIVE_LIKE_STATUSES = ["like", "superlike"];
const PENDING_LIKE_STATUSES = ["pending_like", "pending_superlike"];

const orderIds = (a, b) => {
  const aStr = String(a);
  const bStr = String(b);
  return aStr < bStr ? [a, b] : [b, a];
};

const ensureMatch = async (userA, userB) => {
  const [user1, user2] = orderIds(userA, userB);
  try {
    const match = await models.Match.findOneAndUpdate(
      { user1_id: user1, user2_id: user2 },
      {
        $setOnInsert: {
          user1_id: user1,
          user2_id: user2,
          created_at: new Date()
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return match;
  } catch (err) {
    if (err && err.code === 11000) {
      return models.Match.findOne({ user1_id: user1, user2_id: user2 });
    }
    throw err;
  }
};

const emitMatch = (app, userId, otherId, match) => {
  const io = app?.get?.("io");
  if (!io || !match) return;
  io.to(`user:${userId}`).emit("match:new", match);
  io.to(`user:${otherId}`).emit("match:new", match);
};

const activatePendingLikesForUser = async (userId, app) => {
  const pendingRows = await models.Like.find({
    from_user_id: userId,
    status: { $in: PENDING_LIKE_STATUSES }
  });

  let activatedLikes = 0;
  let createdMatches = 0;

  for (const row of pendingRows) {
    const nextStatus = row.status === "pending_superlike" ? "superlike" : "like";
    row.status = nextStatus;
    await row.save();
    activatedLikes += 1;

    if (nextStatus === "superlike") {
      await models.Superlike.findOneAndUpdate(
        { from_user_id: row.from_user_id, to_user_id: row.to_user_id },
        {
          $setOnInsert: {
            from_user_id: row.from_user_id,
            to_user_id: row.to_user_id,
            created_at: row.created_at || new Date()
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    const reciprocal = await models.Like.findOne({
      from_user_id: row.to_user_id,
      to_user_id: row.from_user_id,
      status: { $in: ACTIVE_LIKE_STATUSES }
    }).lean();

    if (reciprocal) {
      const match = await ensureMatch(row.from_user_id, row.to_user_id);
      emitMatch(app, String(row.from_user_id), String(row.to_user_id), match);
      createdMatches += 1;
    }
  }

  return {
    activated_likes: activatedLikes,
    created_matches: createdMatches
  };
};

module.exports = {
  ACTIVE_LIKE_STATUSES,
  PENDING_LIKE_STATUSES,
  ensureMatch,
  emitMatch,
  activatePendingLikesForUser
};
