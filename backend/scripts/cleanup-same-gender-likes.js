require("dotenv").config();
const { connectDB, models } = require("../src/db");

const run = async () => {
  await connectDB();

  const likes = await models.Like.findAll({
    attributes: ["id", "from_user_id", "to_user_id"]
  });
  let removed = 0;

  for (const like of likes) {
    const [from, to] = await Promise.all([
      models.User.findByPk(like.from_user_id, { attributes: ["id", "gender"] }),
      models.User.findByPk(like.to_user_id, { attributes: ["id", "gender"] })
    ]);

    if (!from || !to) continue;
    if (from.gender && to.gender && from.gender === to.gender) {
      await like.destroy();
      removed += 1;
    }
  }

  console.log(`Removed ${removed} same-gender likes`);
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
