require("dotenv").config();
const bcrypt = require("bcryptjs");
const { connectDB, models } = require("../src/db");

const email = (process.env.ADMIN_EMAIL || process.argv[2] || "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || process.argv[3] || "";
const name = process.env.ADMIN_NAME || "Admin NDOLOLY";

const run = async () => {
  if (!email || !password) {
    throw new Error("Usage: npm run seed:admin -- admin@example.com strong-password");
  }

  await connectDB();

  const passwordHash = bcrypt.hashSync(password, 10);
  let user = await models.User.findOne({ where: { email } });

  if (user) {
    user.email = email;
    user.password_hash = passwordHash;
    user.name = name;
    user.phone = null;
    user.birthdate = "1990-01-01";
    user.gender = "admin";
    user.location = "Backoffice";
    user.verified = true;
    user.verified_photo = true;
    user.role = "admin";
    user.suspended = false;
    user.last_active_at = new Date();
    await user.save();
  } else {
    user = await models.User.create({
      email,
      password_hash: passwordHash,
      name,
      phone: null,
      birthdate: "1990-01-01",
      gender: "admin",
      location: "Backoffice",
      verified: true,
      verified_photo: true,
      role: "admin",
      suspended: false,
      last_active_at: new Date()
    });
  }

  process.stdout.write(`Admin ready: ${user.email}\n`);
  process.exit(0);
};

run().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
