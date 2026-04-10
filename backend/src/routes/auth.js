const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { models } = require("../db");
const { sendOtpEmail } = require("../services/mailer");

const router = express.Router();
const allowedReligions = new Set(["catholique", "protestant", "musulman"]);

const isAdult = (birthdate) => {
  const dob = new Date(birthdate);
  if (Number.isNaN(dob.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age >= 18;
};

const normalizeEmail = (value) => {
  if (!value) return null;
  return String(value).trim().toLowerCase();
};

const normalizePhone = (value) => {
  if (!value) return null;
  return String(value).trim().replace(/[^\d+]/g, "");
};

const signToken = (user) => jwt.sign(
  {
    id: user.id,
    email: user.email,
    phone: user.phone,
    name: user.name,
    role: user.role || "user"
  },
  process.env.JWT_SECRET || "dev_secret_change_me",
  { expiresIn: "7d" }
);

const findUserByContact = async (email, phone) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);
  if (normalizedEmail) {
    return models.User.findOne({ where: { email: normalizedEmail } });
  }
  if (normalizedPhone) {
    return models.User.findOne({ where: { phone: normalizedPhone } });
  }
  return null;
};

const createOtp = async (userId) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await models.Otp.create({
    user_id: userId,
    code,
    expires_at: expiresAt,
    verified: false
  });
  return { code, expiresAt };
};

const isUniqueConstraintError = (err, field) => (
  err?.name === "SequelizeUniqueConstraintError"
  && (!field || err.errors?.some((item) => item.path === field))
);

const normalizeChildrenCount = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.floor(parsed);
};

const normalizeSmoker = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (value === true || value === "true" || value === "yes" || value === "1") return true;
  if (value === false || value === "false" || value === "no" || value === "0") return false;
  return undefined;
};

const normalizeReligion = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).toLowerCase().trim();
  if (!allowedReligions.has(normalized)) return undefined;
  return normalized;
};

router.post("/register", async (req, res) => {
  const {
    email,
    phone,
    password,
    name,
    birthdate,
    gender,
    location,
    children_count,
    smoker,
    religion,
    family_status,
    looking_for
  } = req.body || {};

  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedEmail && !normalizedPhone) {
    return res.status(400).json({ error: "Email or phone required" });
  }
  if (!password || !name || !birthdate || !gender || !location) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (!isAdult(birthdate)) {
    return res.status(400).json({ error: "User must be at least 18 years old" });
  }

  if (normalizedEmail) {
    const emailExists = await models.User.findOne({ where: { email: normalizedEmail } });
    if (emailExists) {
      return res.status(409).json({ error: "Adresse email deja utilisee" });
    }
  }
  if (normalizedPhone) {
    const phoneExists = await models.User.findOne({ where: { phone: normalizedPhone } });
    if (phoneExists) {
      return res.status(409).json({ error: "Numero de telephone deja utilise" });
    }
  }

  const normalizedChildren = normalizeChildrenCount(children_count);
  if (normalizedChildren === undefined) {
    return res.status(400).json({ error: "Invalid children count" });
  }
  const normalizedSmoker = normalizeSmoker(smoker);
  if (normalizedSmoker === undefined) {
    return res.status(400).json({ error: "Invalid smoker value" });
  }
  const normalizedReligion = normalizeReligion(religion);
  if (normalizedReligion === undefined) {
    return res.status(400).json({ error: "Invalid religion value" });
  }

  const normalizedFamilyStatus = family_status ? String(family_status).toLowerCase().trim() : "";
  if (normalizedFamilyStatus && !["celibataire", "marie"].includes(normalizedFamilyStatus)) {
    return res.status(400).json({ error: "Invalid family status" });
  }
  const normalizedLookingFor = looking_for ? String(looking_for).toLowerCase().trim() : "";
  if (normalizedLookingFor && !["amour", "amitie"].includes(normalizedLookingFor)) {
    return res.status(400).json({ error: "Invalid looking_for value" });
  }

  let user;
  try {
    const passwordHash = bcrypt.hashSync(password, 10);
    user = await models.User.create({
      email: normalizedEmail || null,
      phone: normalizedPhone || null,
      password_hash: passwordHash,
      name,
      birthdate,
      gender,
      location,
      children_count: normalizedChildren,
      smoker: normalizedSmoker,
      religion: normalizedReligion,
      family_status: normalizedFamilyStatus,
      looking_for: normalizedLookingFor,
      last_active_at: new Date()
    });
  } catch (err) {
    if (isUniqueConstraintError(err, "email")) {
      return res.status(409).json({ error: "Adresse email deja utilisee" });
    }
    if (isUniqueConstraintError(err, "phone")) {
      return res.status(409).json({ error: "Numero de telephone deja utilise" });
    }
    throw err;
  }

  const otp = await createOtp(user.id);
  if (normalizedEmail) {
    sendOtpEmail({ to: normalizedEmail, code: otp.code, purpose: "verify" }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("Failed to send verification email", err);
    });
  }

  return res.status(201).json({
    message: "User created. Verify OTP to activate account.",
    otp: otp.code
  });
});

router.post("/verify", async (req, res) => {
  const { email, phone, code } = req.body || {};
  const user = await findUserByContact(email, phone);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

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

  user.verified = true;
  await user.save();

  return res.json({ message: "Account verified" });
});

router.post("/login", async (req, res) => {
  const { email, phone, password } = req.body || {};
  const user = await findUserByContact(email, phone);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  if (user.role === "admin") {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  if (!user.verified) {
    return res.status(403).json({ error: "Account not verified" });
  }
  if (user.suspended) {
    return res.status(403).json({ error: "Account suspended" });
  }
  const valid = bcrypt.compareSync(password || "", user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  user.last_active_at = new Date();
  await user.save();

  const token = signToken(user);

  return res.json({ token });
});

router.post("/admin/login", async (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const user = await models.User.findOne({ where: { email: normalizedEmail } });
  if (!user || user.role !== "admin") {
    return res.status(401).json({ error: "Invalid admin credentials" });
  }
  if (user.suspended) {
    return res.status(403).json({ error: "Account suspended" });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid admin credentials" });
  }

  user.last_active_at = new Date();
  await user.save();

  const token = signToken(user);
  return res.json({
    token,
    admin: {
      id: user.id,
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});

router.post("/request-reset", async (req, res) => {
  const { email, phone } = req.body || {};
  const user = await findUserByContact(email, phone);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const otp = await createOtp(user.id);
  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail) {
    sendOtpEmail({ to: normalizedEmail, code: otp.code, purpose: "reset" }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("Failed to send reset email", err);
    });
  }
  return res.json({ message: "Reset code generated", otp: otp.code });
});

router.post("/resend-otp", async (req, res) => {
  const { email, phone } = req.body || {};
  const user = await findUserByContact(email, phone);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  if (user.verified) {
    return res.status(400).json({ error: "Account already verified" });
  }

  const otp = await createOtp(user.id);
  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail) {
    sendOtpEmail({ to: normalizedEmail, code: otp.code, purpose: "verify" }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("Failed to resend verification email", err);
    });
  }
  return res.json({ message: "Verification code sent", otp: otp.code });
});

router.post("/reset", async (req, res) => {
  const { email, phone, code, newPassword } = req.body || {};
  const user = await findUserByContact(email, phone);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

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

  user.password_hash = bcrypt.hashSync(newPassword || "", 10);
  await user.save();

  otp.verified = true;
  await otp.save();

  return res.json({ message: "Password updated" });
});

module.exports = router;
