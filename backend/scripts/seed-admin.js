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
  const user = await models.User.findOneAndUpdate(
    { email },
    {
      $set: {
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
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  process.stdout.write(`Admin ready: ${user.email}\n`);
  process.exit(0);
};

run().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
