require("dotenv").config();
const mongoose = require("mongoose");

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/loveconnect";

const likeSchema = new mongoose.Schema({
  from_user_id: mongoose.Schema.Types.ObjectId,
  to_user_id: mongoose.Schema.Types.ObjectId,
  status: String
}, { collection: "likes" });

const userSchema = new mongoose.Schema({
  gender: String
}, { collection: "users" });

const Like = mongoose.model("LikeCleanup", likeSchema);
const User = mongoose.model("UserCleanup", userSchema);

const run = async () => {
  await mongoose.connect(uri);

  const likes = await Like.find({}).lean();
  let removed = 0;

  for (const like of likes) {
    const from = await User.findById(like.from_user_id).lean();
    const to = await User.findById(like.to_user_id).lean();
    if (!from || !to) continue;
    if (from.gender && to.gender && from.gender === to.gender) {
      await Like.deleteOne({ _id: like._id });
      removed += 1;
    }
  }

  console.log(`Removed ${removed} same-gender likes`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
