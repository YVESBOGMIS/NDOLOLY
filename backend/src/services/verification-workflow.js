const { models, Op } = require("../db");

const ACTIVE_LIKE_STATUSES = ["like", "superlike"];
const PENDING_LIKE_STATUSES = ["pending_like", "pending_superlike"];

const orderIds = (a, b) => {
  const aStr = String(a);
  const bStr = String(b);
  return aStr < bStr ? [aStr, bStr] : [bStr, aStr];
};

const ensureMatch = async (userA, userB) => {
  const [user1, user2] = orderIds(userA, userB);
  const where = { user1_id: user1, user2_id: user2 };
  const existing = await models.Match.findOne({ where });
  if (existing) return existing;

  try {
    return await models.Match.create({
      user1_id: user1,
      user2_id: user2,
      created_at: new Date()
    });
  } catch (err) {
    if (err?.name === "SequelizeUniqueConstraintError") {
      return models.Match.findOne({ where });
    }
    throw err;
  }
};

const emitMatch = (app, userId, otherId, match) => {
  const io = app?.get?.("io");
  if (!io || !match) return;
  const payload = match.toJSON ? match.toJSON() : match;
  io.to(`user:${userId}`).emit("match:new", payload);
  io.to(`user:${otherId}`).emit("match:new", payload);
};

const activatePendingLikesForUser = async (userId, app) => {
  const pendingRows = await models.Like.findAll({
    where: {
      from_user_id: userId,
      status: { [Op.in]: PENDING_LIKE_STATUSES }
    }
  });

  let activatedLikes = 0;
  let createdMatches = 0;

  for (const row of pendingRows) {
    const nextStatus = row.status === "pending_superlike" ? "superlike" : "like";
    row.status = nextStatus;
    await row.save();
    activatedLikes += 1;

    if (nextStatus === "superlike") {
      const [record] = await models.Superlike.findOrCreate({
        where: {
          from_user_id: row.from_user_id,
          to_user_id: row.to_user_id
        },
        defaults: {
          from_user_id: row.from_user_id,
          to_user_id: row.to_user_id,
          created_at: row.created_at || new Date()
        }
      });
      if (!record.created_at && row.created_at) {
        record.created_at = row.created_at;
        await record.save();
      }
    }

    const reciprocal = await models.Like.findOne({
      where: {
        from_user_id: row.to_user_id,
        to_user_id: row.from_user_id,
        status: { [Op.in]: ACTIVE_LIKE_STATUSES }
      }
    });

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
