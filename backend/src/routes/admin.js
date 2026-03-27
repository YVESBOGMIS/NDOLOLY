const express = require("express");
const mongoose = require("mongoose");
const { models } = require("../db");
const { auth, requireAdmin } = require("../middleware/auth");
const { activatePendingLikesForUser } = require("../services/verification-workflow");

const router = express.Router();

router.use(auth, requireAdmin);

const userRoleFilter = {
  $or: [{ role: "user" }, { role: { $exists: false } }]
};

const toObjectId = (value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
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

const pickSafeUser = (user) => ({
  id: user._id,
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
});

router.get("/me", async (req, res) => {
  return res.json({
    id: req.user.id,
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
    verificationCounts,
    matchesTotal,
    messagesTotal,
    activeUsers
  ] = await Promise.all([
    models.User.countDocuments(userRoleFilter),
    models.User.countDocuments({ ...userRoleFilter, verified: true }),
    models.User.countDocuments({ ...userRoleFilter, premium: true }),
    models.User.countDocuments({ ...userRoleFilter, suspended: true }),
    models.Report.countDocuments({ status: "pending" }),
    models.PhotoVerification.aggregate([
      { $group: { _id: "$status", total: { $sum: 1 } } }
    ]),
    models.Match.countDocuments({}),
    models.Message.countDocuments({}),
    models.User.countDocuments({ ...userRoleFilter, last_active_at: { $gte: sevenDaysAgo } })
  ]);

  const verificationMetrics = verificationCounts.reduce((acc, row) => {
    const key = String(row?._id || "").trim().toLowerCase();
    if (!key) return acc;
    acc[key] = row.total || 0;
    return acc;
  }, {});
  const pendingVerifications = verificationMetrics.pending || 0;
  const approvedVerifications = verificationMetrics.approved || 0;
  const rejectedVerifications = verificationMetrics.rejected || 0;
  const totalVerifications = pendingVerifications + approvedVerifications + rejectedVerifications;

  const recentUsers = await models.User.find(userRoleFilter)
    .sort({ created_at: -1 })
    .limit(6)
    .lean();

  const recentReports = await models.Report.find({})
    .sort({ created_at: -1 })
    .limit(6)
    .lean();

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
    recent_users: recentUsers.map(pickSafeUser),
    recent_reports: recentReports
  });
});

router.get("/users", async (req, res) => {
  const search = String(req.query?.search || "").trim();
  const status = String(req.query?.status || "all").trim().toLowerCase();
  const role = String(req.query?.role || "user").trim().toLowerCase();

  const clauses = [];
  if (role !== "all") {
    if (role === "user") {
      clauses.push(userRoleFilter);
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
      $or: [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { location: { $regex: search, $options: "i" } }
      ]
    });
  }

  const query = clauses.length > 0 ? { $and: clauses } : {};

  const users = await models.User.find(query)
    .sort({ created_at: -1 })
    .limit(100)
    .lean();

  const userIds = users.map((item) => item._id);

  const [reportCounts, verificationRows] = await Promise.all([
    models.Report.aggregate([
      { $match: { reported_id: { $in: userIds } } },
      { $group: { _id: "$reported_id", total: { $sum: 1 }, pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } } } }
    ]),
    models.PhotoVerification.aggregate([
      { $match: { user_id: { $in: userIds } } },
      { $sort: { submitted_at: -1 } },
      { $group: { _id: "$user_id", status: { $first: "$status" }, submitted_at: { $first: "$submitted_at" } } }
    ])
  ]);

  const reportMap = new Map(reportCounts.map((row) => [String(row._id), row]));
  const verificationMap = new Map(verificationRows.map((row) => [String(row._id), row]));

  return res.json(users.map((user) => {
    const reportInfo = reportMap.get(String(user._id));
    const verificationInfo = verificationMap.get(String(user._id));
    return {
      ...pickSafeUser(user),
      reports_total: reportInfo?.total || 0,
      reports_pending: reportInfo?.pending || 0,
      verification_status: verificationInfo?.status || "none",
      verification_submitted_at: verificationInfo?.submitted_at || null
    };
  }));
});

router.patch("/users/:id", async (req, res) => {
  const userId = req.params.id;
  const user = await models.User.findById(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const { suspended, premium, verified, verified_photo, role } = req.body || {};
  if (String(user._id) === String(req.user.id) && (suspended === true || role === "user")) {
    return res.status(400).json({ error: "You cannot revoke your own admin access" });
  }

  if (typeof suspended === "boolean") user.suspended = suspended;
  if (typeof premium === "boolean") {
    user.premium = premium;
    if (!premium) {
      user.incognito_mode = false;
    }
  }
  if (typeof verified === "boolean") user.verified = verified;
  const shouldActivatePendingLikes = typeof verified_photo === "boolean" && verified_photo === true && !user.verified_photo;
  if (typeof verified_photo === "boolean") {
    user.verified_photo = verified_photo;
    user.reverification_required = !verified_photo;
  }
  if (role === "user" || role === "admin") user.role = role;

  await user.save();
  if (typeof verified_photo === "boolean") {
    const latestVerification = await models.PhotoVerification.findOne({ user_id: user._id })
      .sort({ submitted_at: -1 });
    if (latestVerification) {
      latestVerification.status = verified_photo ? "approved" : "rejected";
      latestVerification.reviewed_at = new Date();
      latestVerification.reviewed_by = req.user.id;
      if (!latestVerification.photo_url && user.photos?.length) {
        latestVerification.photo_url = user.photos[user.photos.length - 1];
      }
      if (!latestVerification.note) {
        latestVerification.note = verified_photo
          ? "Validation effectuee depuis la gestion utilisateurs"
          : "Badge photo retire depuis la gestion utilisateurs";
      }
      await latestVerification.save();
    }
    if (!verified_photo) {
      await models.PhotoVerification.updateMany(
        { user_id: user._id, status: "approved" },
        {
          $set: {
            status: "rejected",
            reviewed_at: new Date(),
            reviewed_by: req.user.id,
            note: "Badge photo retire depuis la gestion utilisateurs"
          }
        }
      );
    }
  }
  if (shouldActivatePendingLikes) {
    await activatePendingLikesForUser(user._id, req.app);
  }
  return res.json({ message: "User updated", user: pickSafeUser(user.toObject()) });
});

router.get("/users/:id/conversations", async (req, res) => {
  const userId = req.params.id;
  const user = await models.User.findById(userId).lean();
  if (!user) return res.status(404).json({ error: "User not found" });

  const matches = await models.Match.find({
    $or: [{ user1_id: userId }, { user2_id: userId }]
  })
    .sort({ created_at: -1 })
    .lean();

  const allUserIds = [...new Set(matches.flatMap((match) => [
    String(match.user1_id),
    String(match.user2_id)
  ]))]
    .map(toObjectId)
    .filter(Boolean);

  const users = await models.User.find({ _id: { $in: allUserIds } })
    .select("name email phone location photos")
    .lean();
  const userMap = new Map(users.map((item) => [String(item._id), pickSafeUser(item)]));

  const matchIds = matches.map((match) => match._id);
  const messages = await models.Message.find({ match_id: { $in: matchIds } })
    .sort({ created_at: 1 })
    .lean();
  const messagesByMatch = new Map();
  for (const message of messages) {
    const key = String(message.match_id);
    const bucket = messagesByMatch.get(key) || [];
    bucket.push({
      id: message._id,
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
    const conversationMessages = messagesByMatch.get(String(match._id)) || [];
    const lastMessage = conversationMessages[conversationMessages.length - 1] || null;
    return {
      id: match._id,
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

  const user = await models.User.findById(userId);
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
    user: pickSafeUser(user.toObject())
  });
});

router.get("/reports", async (req, res) => {
  const status = String(req.query?.status || "all").trim().toLowerCase();
  const query = {};
  if (status !== "all") query.status = status;

  const reports = await models.Report.find(query)
    .sort({ created_at: -1 })
    .limit(100)
    .lean();

  const userIds = [...new Set(
    reports.flatMap((report) => [String(report.reporter_id), String(report.reported_id)])
  )]
    .map(toObjectId)
    .filter(Boolean);

  const users = await models.User.find({ _id: { $in: userIds } })
    .select("name email phone photos suspended")
    .lean();
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  return res.json(reports.map((report) => ({
    id: report._id,
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
  const report = await models.Report.findById(req.params.id);
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
  const query = {};
  if (status !== "all") query.status = status;

  const rows = await models.PhotoVerification.find(query)
    .sort({ submitted_at: -1 })
    .limit(100)
    .lean();

  const verificationUserIds = rows.map((row) => row.user_id);
  const legacyQuery = {
    ...userRoleFilter,
    verified_photo: true,
    photos: { $exists: true, $ne: [] }
  };
  const legacyUsers = status === "pending"
    ? []
    : await models.User.find(legacyQuery)
      .sort({ created_at: -1 })
      .limit(100)
      .lean();

  const userIds = [...new Set([
    ...verificationUserIds.map((id) => String(id)),
    ...legacyUsers.map((user) => String(user._id))
  ])]
    .map(toObjectId)
    .filter(Boolean);

  const users = await models.User.find({ _id: { $in: userIds } })
    .select("name email phone location photos verified_photo suspended created_at last_active_at")
    .lean();
  const userMap = new Map(users.map((user) => [String(user._id), pickSafeUser(user)]));

  const verificationRows = rows.map((row) => {
    const user = userMap.get(String(row.user_id)) || null;
    const fallbackPhoto = user?.photos?.length ? user.photos[user.photos.length - 1] : null;
    return {
      id: row._id,
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
    .map((user) => userMap.get(String(user._id)))
    .filter(Boolean)
    .filter((user) => !existingUserIds.has(String(user.id)))
    .map((user) => ({
      id: `legacy:${user.id}`,
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
  const row = await models.PhotoVerification.findById(req.params.id);
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
    const user = await models.User.findById(row.user_id).select("photos").lean();
    if (user?.photos?.length) {
      row.photo_url = user.photos[user.photos.length - 1];
    }
  }
  await row.save();

  await models.User.updateOne(
    { _id: row.user_id },
    {
      verified_photo: action === "approve",
      reverification_required: false
    }
  );

  if (action === "approve") {
    await activatePendingLikesForUser(row.user_id, req.app);
  }

  return res.json({ message: `Verification ${row.status}` });
});

module.exports = router;
