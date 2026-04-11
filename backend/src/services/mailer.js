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

const getWebAppUrl = () => {
  const raw =
    (process.env.WEB_APP_URL ||
      process.env.FRONTEND_URL ||
      process.env.CLIENT_URL ||
      process.env.PUBLIC_APP_URL ||
      "").trim();
  return raw || null;
};

const normalizeBaseUrl = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
};

const buildWebUrl = (path, params) => {
  const base = normalizeBaseUrl(getWebAppUrl());
  if (!base) return null;
  try {
    const url = new URL(base);
    url.pathname = String(path || "/");
    url.search = "";
    if (params && typeof params === "object") {
      Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === undefined || value === "") return;
        url.searchParams.set(key, String(value));
      });
    }
    return url.toString();
  } catch {
    return null;
  }
};

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
  const actionLabel = isReset ? "de reinitialisation" : "de verification";
  const link = isReset
    ? buildWebUrl("/reset-password", { contact: to, code })
    : buildWebUrl("/verify-account", { contact: to, code });

  const lines = [
    `Votre code ${actionLabel} est : ${code}.`,
    "Ce code expire dans 10 minutes."
  ];
  if (link) {
    lines.push("");
    lines.push(isReset
      ? "Lien pour revenir a la page de reinitialisation :"
      : "Lien pour revenir a la page de verification :");
    lines.push(link);
  }

  const text = `${lines.join("\n")}\n`;
  const html = `
    <div style="font-family:Arial, Helvetica, sans-serif; line-height:1.5; color:#111;">
      <p>Votre code ${actionLabel} est : <strong>${code}</strong>.</p>
      <p>Ce code expire dans 10 minutes.</p>
      ${link ? `<p>${isReset ? "Reinitialiser" : "Verifier"} via ce lien :<br /><a href="${link}">${link}</a></p>` : ""}
    </div>
  `.trim();

  await transporter.sendMail({
    from: getFromAddress(),
    to,
    subject,
    text,
    html
  });

  return { skipped: false };
};

module.exports = { sendOtpEmail };
