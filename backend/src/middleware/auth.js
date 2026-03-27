const jwt = require("jsonwebtoken");
const { models } = require("../db");

const auth = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev_secret_change_me");
    const user = await models.User.findById(payload.id)
      .select("email phone name role suspended verified reverification_required")
      .lean();

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    if (user.suspended) {
      return res.status(403).json({ error: "Account suspended" });
    }

    const routeKey = `${req.method.toUpperCase()} ${req.baseUrl}${req.path}`;
    const reverifyAllowed = new Set([
      "GET /profile/me",
      "GET /profile/verification-status",
      "POST /profile/verify-request"
    ]);
    const isReverifyAllowed = reverifyAllowed.has(routeKey);
    if (user.role !== "admin" && user.reverification_required && !isReverifyAllowed) {
      return res.status(423).json({
        error: "Account locked until a new photo verification is submitted",
        reverification_required: true
      });
    }

    req.user = {
      id: String(payload.id),
      email: user.email || null,
      phone: user.phone || null,
      name: user.name,
      role: user.role || "user",
      verified: !!user.verified,
      reverification_required: !!user.reverification_required
    };
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  return next();
};

module.exports = { auth, requireAdmin };
