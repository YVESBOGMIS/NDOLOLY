require("dotenv").config();
const { connectDB, models } = require("../src/db");

const COMPRESS_QUERY = "auto=compress&cs=tinysrgb&w=720&dpr=1";

const normalizePexelsUrl = (url) => {
  if (typeof url !== "string") return url;
  if (!url.includes("images.pexels.com/photos/")) return url;
  const base = url.split("?")[0];
  return `${base}?${COMPRESS_QUERY}`;
};

const run = async () => {
  await connectDB();
  const users = await models.User.find({});
  let updated = 0;

  for (const user of users) {
    if (!Array.isArray(user.photos) || user.photos.length === 0) continue;
    const nextPhotos = user.photos.map(normalizePexelsUrl);
    const changed = nextPhotos.some((photo, idx) => photo !== user.photos[idx]);
    if (changed) {
      user.photos = nextPhotos;
      await user.save();
      updated += 1;
    }
  }

  console.log(`Updated photos for ${updated} users.`);
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
