const nodemailer = require("nodemailer");

const isTrue = (value) => String(value || "").toLowerCase() === "true";

const buildTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 0);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: isTrue(process.env.SMTP_SECURE),
    auth: { user, pass }
  });
};

let cachedTransporter = null;

const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = buildTransporter();
  return cachedTransporter;
};

const getFromAddress = () => {
  const name =
    (process.env.APP_FROM_EMAIL || process.env.APP_NAME || "").trim() ||
    "NDOLOLY";
  const email = process.env.SMTP_USER || "no-reply@localhost";
  return `${name} <${email}>`;
};

const getAppName = () =>
  (process.env.APP_NAME || "").trim() || "NDOLOLY";

const sendOtpEmail = async ({ to, code, purpose }) => {
  const transporter = getTransporter();
  if (!transporter) {
    return { skipped: true, reason: "SMTP not configured" };
  }

  const appName = getAppName();
  const isReset = purpose === "reset";
  const subject = isReset
    ? `${appName} - Code de reinitialisation`
    : `${appName} - Verification du compte`;
  const text = `Votre code ${
    isReset ? "de reinitialisation" : "de verification"
  } est : ${code}. Ce code expire dans 10 minutes.`;

  await transporter.sendMail({
    from: getFromAddress(),
    to,
    subject,
    text
  });

  return { skipped: false };
};

module.exports = { sendOtpEmail };
