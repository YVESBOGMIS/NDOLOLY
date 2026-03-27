require("dotenv").config();
const mongoose = require("mongoose");

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/loveconnect";

const matchSchema = new mongoose.Schema({
  user1_id: mongoose.Schema.Types.ObjectId,
  user2_id: mongoose.Schema.Types.ObjectId
}, { collection: "matches" });

const userSchema = new mongoose.Schema({
  gender: String
}, { collection: "users" });

const Match = mongoose.model("MatchCleanup", matchSchema);
const User = mongoose.model("UserCleanup2", userSchema);

const run = async () => {
  await mongoose.connect(uri);

  const matches = await Match.find({}).lean();
  let removed = 0;

  for (const match of matches) {
    const user1 = await User.findById(match.user1_id).lean();
    const user2 = await User.findById(match.user2_id).lean();
    if (!user1 || !user2) continue;
    if (user1.gender && user2.gender && user1.gender === user2.gender) {
      await Match.deleteOne({ _id: match._id });
      removed += 1;
    }
  }

  console.log(`Removed ${removed} same-gender matches`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
