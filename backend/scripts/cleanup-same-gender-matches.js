require("dotenv").config();
const { connectDB, models } = require("../src/db");

const run = async () => {
  await connectDB();

  const matches = await models.Match.findAll({
    attributes: ["id", "user1_id", "user2_id"]
  });
  let removed = 0;

  for (const match of matches) {
    const [user1, user2] = await Promise.all([
      models.User.findByPk(match.user1_id, { attributes: ["id", "gender"] }),
      models.User.findByPk(match.user2_id, { attributes: ["id", "gender"] })
    ]);

    if (!user1 || !user2) continue;
    if (user1.gender && user2.gender && user1.gender === user2.gender) {
      await match.destroy();
      removed += 1;
    }
  }

  console.log(`Removed ${removed} same-gender matches`);
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
