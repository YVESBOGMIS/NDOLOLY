const express = require("express");
const { models, Op } = require("../db");
const { auth, requireAdmin } = require("../middleware/auth");
const { activatePendingLikesForUser } = require("../services/verification-workflow");

const router = express.Router();

router.use(auth, requireAdmin);

const userRoleWhere = {
  [Op.or]: [{ role: "user" }, { role: null }]
};

const andWhere = (...clauses) => {
  const filtered = clauses.filter(Boolean);
  if (filtered.length === 0) return {};
  if (filtered.length === 1) return filtered[0];
  return { [Op.and]: filtered };
};

const getPresenceTracker = (req) => req.app?.get("presence") || null;

const isUserOnlineNow = (req, userId) => {
  const tracker = getPresenceTracker(req);
  if (!tracker || typeof tracker.isUserOnline !== "function") return false;
  return tracker.isUserOnline(userId);
};

const isRecentlyActive = (value, windowMs = 2 * 60 * 1000) => {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp <= windowMs;
};

const safeRemoveUpload = async (photoPath) => {
  if (!photoPath || typeof photoPath !== "string") return;
  if (!photoPath.startsWith("/uploads/")) return;
  const path = require("path");
  const fs = require("fs/promises");
  const uploadsDir = path.join(__dirname, "..", "..", "uploads");
  const filename = path.basename(photoPath);
  const fullPath = path.join(uploadsDir, filename);
  try {
    await fs.unlink(fullPath);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("Failed to delete upload:", err.message);
    }
  }
};

const toPlain = (row) => (row?.toJSON ? row.toJSON() : row);

const pickSafeUser = (input) => {
  const user = toPlain(input);
  return {
    id: user.id,
    _id: user.id,
    name: user.name,
    email: user.email || "",
    phone: user.phone || "",
    gender: user.gender || "",
    location: user.location || "",
    verified: !!user.verified,
    verified_photo: !!user.verified_photo,
    reverification_required: !!user.reverification_required,
    premium: !!user.premium,
    incognito_mode: !!user.premium && !!user.incognito_mode,
    suspended: !!user.suspended,
    role: user.role || "user",
    photos: user.photos || [],
    created_at: user.created_at,
    last_active_at: user.last_active_at
  };
};

router.get("/me", async (req, res) => {
  return res.json({
    id: req.user.id,
    _id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role
  });
});

router.get("/overview", async (req, res) => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    usersTotal,
    usersVerified,
    premiumUsers,
    suspendedUsers,
    pendingReports,
    pendingVerifications,
    approvedVerifications,
    rejectedVerifications,
    matchesTotal,
    messagesTotal,
    activeUsers,
    recentUsersRows,
    recentReportsRows
  ] = await Promise.all([
    models.User.count({ where: userRoleWhere }),
    models.User.count({ where: andWhere(userRoleWhere, { verified: true }) }),
    models.User.count({ where: andWhere(userRoleWhere, { premium: true }) }),
    models.User.count({ where: andWhere(userRoleWhere, { suspended: true }) }),
    models.Report.count({ where: { status: "pending" } }),
    models.PhotoVerification.count({ where: { status: "pending" } }),
    models.PhotoVerification.count({ where: { status: "approved" } }),
    models.PhotoVerification.count({ where: { status: "rejected" } }),
    models.Match.count(),
    models.Message.count(),
    models.User.count({ where: andWhere(userRoleWhere, { last_active_at: { [Op.gte]: sevenDaysAgo } }) }),
    models.User.findAll({ where: userRoleWhere, order: [["created_at", "DESC"]], limit: 6 }),
    models.Report.findAll({ order: [["created_at", "DESC"]], limit: 6 })
  ]);

  const totalVerifications = pendingVerifications + approvedVerifications + rejectedVerifications;

  return res.json({
    metrics: {
      users_total: usersTotal,
      users_verified: usersVerified,
      premium_users: premiumUsers,
      suspended_users: suspendedUsers,
      pending_reports: pendingReports,
      pending_verifications: pendingVerifications,
      approved_verifications: approvedVerifications,
      rejected_verifications: rejectedVerifications,
      total_verifications: totalVerifications,
      matches_total: matchesTotal,
      messages_total: messagesTotal,
      active_users_7d: activeUsers
    },
    recent_users: recentUsersRows.map((row) => ({
      ...pickSafeUser(row),
      is_online: isUserOnlineNow(req, row.id) || isRecentlyActive(row.last_active_at)
    })),
    recent_reports: recentReportsRows.map(toPlain)
  });
});

router.get("/users", async (req, res) => {
  const search = String(req.query?.search || "").trim();
  const status = String(req.query?.status || "all").trim().toLowerCase();
  const role = String(req.query?.role || "user").trim().toLowerCase();

  const clauses = [];
  if (role !== "all") {
    if (role === "user") {
      clauses.push(userRoleWhere);
    } else {
      clauses.push({ role });
    }
  }
  if (status === "suspended") clauses.push({ suspended: true });
  if (status === "active") clauses.push({ suspended: false });
  if (status === "premium") clauses.push({ premium: true });
  if (status === "unverified") clauses.push({ verified: false });
  if (search) {
    clauses.push({
      [Op.or]: [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } }
      ]
    });
  }

  const where = andWhere(...clauses);

  const usersRows = await models.User.findAll({
    where,
    order: [["created_at", "DESC"]],
    limit: 100
  });

  const users = usersRows.map(toPlain);
  const userIds = users.map((item) => item.id);

  const now = new Date();
  const [reportRows, verificationRowsRaw, otpRowsRaw] = await Promise.all([
    userIds.length === 0
      ? []
      : models.Report.findAll({
        where: { reported_id: { [Op.in]: userIds } },
        attributes: ["reported_id", "status"]
      }),
    userIds.length === 0
      ? []
      : models.PhotoVerification.findAll({
        where: { user_id: { [Op.in]: userIds } },
        order: [["submitted_at", "DESC"]]
      }),
    userIds.length === 0
      ? []
      : models.Otp.findAll({
        where: {
          user_id: { [Op.in]: userIds },
          verified: false,
          expires_at: { [Op.gt]: now }
        },
        order: [["created_at", "DESC"]]
      })
  ]);

  const reportMap = new Map();
  for (const rowRecord of reportRows) {
    const row = toPlain(rowRecord);
    const key = String(row.reported_id);
    const current = reportMap.get(key) || { total: 0, pending: 0 };
    current.total += 1;
    if (row.status === "pending") current.pending += 1;
    reportMap.set(key, current);
  }

  const verificationMap = new Map();
  for (const rowRecord of verificationRowsRaw) {
    const row = toPlain(rowRecord);
    const key = String(row.user_id);
    if (!verificationMap.has(key)) {
      verificationMap.set(key, row);
    }
  }

  const otpPendingMap = new Map();
  for (const rowRecord of otpRowsRaw) {
    const row = toPlain(rowRecord);
    const key = String(row.user_id);
    if (!otpPendingMap.has(key)) {
      otpPendingMap.set(key, row);
    }
  }

  return res.json(users.map((user) => {
    const reportInfo = reportMap.get(String(user.id));
    const verificationInfo = verificationMap.get(String(user.id));
    const pendingOtp = otpPendingMap.get(String(user.id)) || null;
    return {
      ...pickSafeUser(user),
      reports_total: reportInfo?.total || 0,
      reports_pending: reportInfo?.pending || 0,
      verification_status: verificationInfo?.status || "none",
      verification_submitted_at: verificationInfo?.submitted_at || null,
      otp_pending: !!pendingOtp,
      otp_expires_at: pendingOtp?.expires_at || null,
      is_online: isUserOnlineNow(req, user.id) || isRecentlyActive(user.last_active_at)
    };
  }));
});

router.patch("/users/:id", async (req, res) => {
  const userId = req.params.id;
  const user = await models.User.findByPk(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const { suspended, premium, verified, verified_photo, role } = req.body || {};
  if (String(user.id) === String(req.user.id) && (suspended === true || role === "user")) {
    return res.status(400).json({ error: "You cannot revoke your own admin access" });
  }

  const updates = {};

  if (typeof suspended === "boolean") updates.suspended = suspended;
  if (typeof premium === "boolean") {
    updates.premium = premium;
    if (!premium) {
      updates.incognito_mode = false;
    }
  }
  if (typeof verified === "boolean") updates.verified = verified;
  const shouldActivatePendingLikes = typeof verified_photo === "boolean" && verified_photo === true && !user.verified_photo;
  if (typeof verified_photo === "boolean") {
    updates.verified_photo = verified_photo;
    updates.reverification_required = !verified_photo;
  }
  if (role === "user" || role === "admin") updates.role = role;

  // Legacy rows can contain null role values; normalize them during admin updates.
  if (!user.role && !updates.role) {
    updates.role = "user";
  }

  if (Object.keys(updates).length > 0) {
    await models.User.update(updates, { where: { id: user.id } });
  }
  const refreshedUser = await models.User.findByPk(user.id);
  if (!refreshedUser) return res.status(404).json({ error: "User not found" });

  if (typeof verified_photo === "boolean") {
    const latestVerification = await models.PhotoVerification.findOne({
      where: { user_id: refreshedUser.id },
      order: [["submitted_at", "DESC"]]
    });
    if (latestVerification) {
      latestVerification.status = verified_photo ? "approved" : "rejected";
      latestVerification.reviewed_at = new Date();
      latestVerification.reviewed_by = req.user.id;
      if (!latestVerification.photo_url && refreshedUser.photos?.length) {
        latestVerification.photo_url = refreshedUser.photos[refreshedUser.photos.length - 1];
      }
      if (!latestVerification.note) {
        latestVerification.note = verified_photo
          ? "Validation effectuee depuis la gestion utilisateurs"
          : "Badge photo retire depuis la gestion utilisateurs";
      }
      await latestVerification.save();
    }
    if (!verified_photo) {
      await models.PhotoVerification.update(
        {
          status: "rejected",
          reviewed_at: new Date(),
          reviewed_by: req.user.id,
          note: "Badge photo retire depuis la gestion utilisateurs"
        },
        {
          where: {
            user_id: refreshedUser.id,
            status: "approved"
          }
        }
      );
    }
  }
  if (shouldActivatePendingLikes) {
    await activatePendingLikesForUser(refreshedUser.id, req.app);
  }
  return res.json({ message: "User updated", user: pickSafeUser(refreshedUser) });
});

router.post("/users/:id/verify-account", async (req, res) => {
  const userId = req.params.id;
  const user = await models.User.findByPk(userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  if ((user.role || "user") === "admin") {
    return res.status(400).json({ error: "Cannot verify an admin account" });
  }

  if (user.verified) {
    if (!user.role) {
      await models.User.update({ role: "user" }, { where: { id: user.id } });
    }
    const alreadyVerified = await models.User.findByPk(user.id);
    return res.json({ message: "Account already verified", user: pickSafeUser(alreadyVerified || user) });
  }

  const code = String(req.body?.code || "").trim();
  if (code) {
    const otp = await models.Otp.findOne({
      where: {
        user_id: user.id,
        code,
        verified: false
      },
      order: [["created_at", "DESC"]]
    });
    if (!otp) {
      return res.status(400).json({ error: "Invalid code" });
    }
    if (new Date(otp.expires_at) < new Date()) {
      return res.status(400).json({ error: "Code expired" });
    }
    otp.verified = true;
    await otp.save();
  } else {
    // Force-verify without OTP (manual admin override).
    await models.Otp.update(
      { verified: true },
      { where: { user_id: user.id, verified: false } }
    );
  }

  const verifyUpdates = { verified: true };
  if (!user.role) {
    verifyUpdates.role = "user";
  }
  await models.User.update(verifyUpdates, { where: { id: user.id } });
  const refreshedUser = await models.User.findByPk(user.id);

  return res.json({
    message: code ? "Account verified (OTP confirmed)" : "Account verified (admin override)",
    user: pickSafeUser(refreshedUser || user)
  });
});

router.get("/users/:id/conversations", async (req, res) => {
  const userId = req.params.id;
  const user = await models.User.findByPk(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const matchesRows = await models.Match.findAll({
    where: {
      [Op.or]: [{ user1_id: userId }, { user2_id: userId }]
    },
    order: [["created_at", "DESC"]]
  });
  const matches = matchesRows.map(toPlain);

  const allUserIds = [...new Set(matches.flatMap((match) => [
    String(match.user1_id),
    String(match.user2_id)
  ]))];

  const usersRows = allUserIds.length === 0
    ? []
    : await models.User.findAll({
      where: { id: { [Op.in]: allUserIds } },
      attributes: ["id", "name", "email", "phone", "location", "photos", "verified", "verified_photo", "premium", "incognito_mode", "suspended", "role", "reverification_required", "created_at", "last_active_at"]
    });
  const userMap = new Map(usersRows.map((item) => [String(item.id), pickSafeUser(item)]));

  const matchIds = matches.map((match) => match.id);
  const messagesRows = matchIds.length === 0
    ? []
    : await models.Message.findAll({
      where: { match_id: { [Op.in]: matchIds } },
      order: [["created_at", "ASC"]]
    });
  const messages = messagesRows.map(toPlain);
  const messagesByMatch = new Map();
  for (const message of messages) {
    const key = String(message.match_id);
    const bucket = messagesByMatch.get(key) || [];
    bucket.push({
      id: message.id,
      _id: message.id,
      match_id: String(message.match_id),
      from_user_id: String(message.from_user_id),
      to_user_id: String(message.to_user_id),
      type: message.type,
      content: message.content || "",
      media_url: message.media_url || null,
      created_at: message.created_at,
      delivered_at: message.delivered_at || null,
      read_at: message.read_at || null,
      listened_at: message.listened_at || null
    });
    messagesByMatch.set(key, bucket);
  }

  const payload = matches.map((match) => {
    const otherUserId = String(match.user1_id) === String(userId)
      ? String(match.user2_id)
      : String(match.user1_id);
    const conversationMessages = messagesByMatch.get(String(match.id)) || [];
    const lastMessage = conversationMessages[conversationMessages.length - 1] || null;
    return {
      id: match.id,
      _id: match.id,
      created_at: match.created_at,
      other_user: userMap.get(otherUserId) || null,
      messages_count: conversationMessages.length,
      last_message_at: lastMessage?.created_at || match.created_at,
      messages: conversationMessages
    };
  });

  return res.json({
    user: pickSafeUser(user),
    conversations: payload
  });
});

router.delete("/users/:id/photos", async (req, res) => {
  const userId = req.params.id;
  const photo = req.body?.photo;
  if (!photo) return res.status(400).json({ error: "Missing photo" });

  const user = await models.User.findByPk(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const photos = user.photos || [];
  if (!photos.includes(photo)) {
    return res.status(404).json({ error: "Photo not found" });
  }

  user.photos = photos.filter((item) => item !== photo);
  await user.save();

  await safeRemoveUpload(photo);

  return res.json({
    message: "Photo deleted",
    user: pickSafeUser(user)
  });
});

router.get("/reports", async (req, res) => {
  const status = String(req.query?.status || "all").trim().toLowerCase();
  const where = {};
  if (status !== "all") where.status = status;

  const reportsRows = await models.Report.findAll({
    where,
    order: [["created_at", "DESC"]],
    limit: 100
  });
  const reports = reportsRows.map(toPlain);

  const userIds = [...new Set(
    reports.flatMap((report) => [String(report.reporter_id), String(report.reported_id)])
  )];

  const usersRows = userIds.length === 0
    ? []
    : await models.User.findAll({
      where: { id: { [Op.in]: userIds } },
      attributes: ["id", "name", "email", "phone", "photos", "suspended"]
    });
  const userMap = new Map(usersRows.map((user) => [String(user.id), toPlain(user)]));

  return res.json(reports.map((report) => ({
    id: report.id,
    _id: report.id,
    reason: report.reason,
    status: report.status || "pending",
    note: report.note || "",
    created_at: report.created_at,
    reviewed_at: report.reviewed_at,
    reporter: userMap.get(String(report.reporter_id)) || null,
    reported: userMap.get(String(report.reported_id)) || null
  })));
});

router.post("/reports/:id/review", async (req, res) => {
  const report = await models.Report.findByPk(req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found" });

  report.status = "reviewed";
  report.note = String(req.body?.note || "").trim();
  report.reviewed_at = new Date();
  report.reviewed_by = req.user.id;
  await report.save();

  return res.json({ message: "Report reviewed" });
});

router.get("/verifications", async (req, res) => {
  const status = String(req.query?.status || "pending").trim().toLowerCase();
  const where = {};
  if (status !== "all") where.status = status;

  const rowsRecords = await models.PhotoVerification.findAll({
    where,
    order: [["submitted_at", "DESC"]],
    limit: 100
  });
  const rows = rowsRecords.map(toPlain);

  const legacyUserRecords = status === "pending"
    ? []
    : await models.User.findAll({
      where: andWhere(userRoleWhere, { verified_photo: true }),
      order: [["created_at", "DESC"]],
      limit: 100
    });
  const legacyUsers = legacyUserRecords
    .map(toPlain)
    .filter((user) => Array.isArray(user.photos) && user.photos.length > 0);

  const userIds = [...new Set([
    ...rows.map((row) => String(row.user_id)),
    ...legacyUsers.map((user) => String(user.id))
  ])];

  const usersRows = userIds.length === 0
    ? []
    : await models.User.findAll({
      where: { id: { [Op.in]: userIds } },
      attributes: [
        "id",
        "name",
        "email",
        "phone",
        "location",
        "photos",
        "verified",
        "verified_photo",
        "premium",
        "incognito_mode",
        "suspended",
        "role",
        "reverification_required",
        "created_at",
        "last_active_at"
      ]
    });
  const userMap = new Map(usersRows.map((user) => [String(user.id), pickSafeUser(user)]));

  const verificationRows = rows.map((row) => {
    const user = userMap.get(String(row.user_id)) || null;
    const fallbackPhoto = user?.photos?.length ? user.photos[user.photos.length - 1] : null;
    return {
      id: row.id,
      _id: row.id,
      source: "request",
      status: row.status,
      photo_url: row.photo_url || fallbackPhoto || null,
      submitted_at: row.submitted_at,
      reviewed_at: row.reviewed_at,
      note: row.note || "",
      user
    };
  });

  const existingUserIds = new Set(verificationRows.map((row) => String(row.user?.id || "")));
  const legacyRows = legacyUsers
    .map((user) => userMap.get(String(user.id)))
    .filter(Boolean)
    .filter((user) => !existingUserIds.has(String(user.id)))
    .map((user) => ({
      id: `legacy:${user.id}`,
      _id: `legacy:${user.id}`,
      source: "legacy",
      status: "approved",
      photo_url: user.photos?.length ? user.photos[user.photos.length - 1] : null,
      submitted_at: user.created_at || null,
      reviewed_at: null,
      note: "Validation historique sans demande formelle enregistree.",
      user
    }));

  return res.json([...verificationRows, ...legacyRows]);
});

router.post("/verifications/:id/decision", async (req, res) => {
  const row = await models.PhotoVerification.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: "Verification not found" });

  const action = String(req.body?.action || "").trim().toLowerCase();
  const note = String(req.body?.note || "").trim();
  if (!["approve", "reject"].includes(action)) {
    return res.status(400).json({ error: "Invalid action" });
  }

  row.status = action === "approve" ? "approved" : "rejected";
  row.note = note;
  row.reviewed_at = new Date();
  row.reviewed_by = req.user.id;
  if (!row.photo_url) {
    const user = await models.User.findByPk(row.user_id, { attributes: ["id", "photos"] });
    if (user?.photos?.length) {
      row.photo_url = user.photos[user.photos.length - 1];
    }
  }
  await row.save();

  await models.User.update(
    {
      verified_photo: action === "approve",
      reverification_required: false
    },
    { where: { id: row.user_id } }
  );

  if (action === "approve") {
    await activatePendingLikesForUser(row.user_id, req.app);
  }

  return res.json({ message: `Verification ${row.status}` });
});

module.exports = router;
