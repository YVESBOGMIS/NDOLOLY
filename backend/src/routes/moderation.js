const express = require("express");
const { models } = require("../db");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.post("/block", auth, async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: "userId required" });

  await models.Block.findOrCreate({
    where: { blocker_id: req.user.id, blocked_id: userId },
    defaults: {
      blocker_id: req.user.id,
      blocked_id: userId,
      created_at: new Date()
    }
  });

  return res.json({ message: "User blocked" });
});

router.post("/report", auth, async (req, res) => {
  const { userId, reason } = req.body || {};
  if (!userId || !reason) return res.status(400).json({ error: "userId and reason required" });

  await models.Report.create({
    reporter_id: req.user.id,
    reported_id: userId,
    reason
  });

  return res.json({ message: "Report submitted" });
});

module.exports = router;
