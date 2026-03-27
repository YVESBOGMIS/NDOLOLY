﻿﻿const mongoose = require("mongoose");

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/loveconnect";
  await mongoose.connect(uri, {
    autoIndex: true
  });
};

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, sparse: true },
  phone: { type: String, unique: true, sparse: true },
  password_hash: { type: String, required: true },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  suspended: { type: Boolean, default: false },
  name: { type: String, required: true },
  birthdate: { type: String, required: true },
  gender: { type: String, required: true },
  location: { type: String, required: true },
  location_city: { type: String, default: "" },
  location_lat: { type: Number, default: null },
  location_lng: { type: Number, default: null },
  location_updated_at: { type: Date, default: null },
  children_count: { type: Number, default: null },
  smoker: { type: Boolean, default: null },
  religion: { type: String, default: null },
  profession: { type: String, default: "" },
  education_level: { type: String, default: "" },
  height_cm: { type: Number, default: null },
  family_status: { type: String, default: "" },
  languages: { type: [String], default: [] },
  looking_for: { type: String, default: "" },
  interests: { type: [String], default: [] },
  bio: { type: String, default: "" },
  photos: { type: [String], default: [] },
  pref_age_min: { type: Number, default: 18 },
  pref_age_max: { type: Number, default: 99 },
  pref_distance_km: { type: Number, default: 50 },
  pref_gender: { type: String, default: "any" },
  verified: { type: Boolean, default: false },
  verified_photo: { type: Boolean, default: false },
  reverification_required: { type: Boolean, default: false },
  premium: { type: Boolean, default: false },
  incognito_mode: { type: Boolean, default: false },
  boost_ends_at: { type: Date, default: null },
  views_count: { type: Number, default: 0 },
  last_active_at: { type: Date, default: null },
  onboarding_completed: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

const otpSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  code: { type: String, required: true },
  expires_at: { type: Date, required: true },
  verified: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

const likeSchema = new mongoose.Schema({
  from_user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  to_user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

likeSchema.index({ from_user_id: 1, to_user_id: 1 }, { unique: true });

const matchSchema = new mongoose.Schema({
  user1_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  user2_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  created_at: { type: Date, default: Date.now }
});

matchSchema.index({ user1_id: 1, user2_id: 1 }, { unique: true });

const messageSchema = new mongoose.Schema({
  match_id: { type: mongoose.Schema.Types.ObjectId, ref: "Match", required: true },
  from_user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  to_user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, default: "text" },
  content: { type: String, default: null },
  media_url: { type: String, default: null },
  delivered_at: { type: Date, default: null },
  read_at: { type: Date, default: null },
  listened_at: { type: Date, default: null },
  created_at: { type: Date, default: Date.now }
});

const blockSchema = new mongoose.Schema({
  blocker_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  blocked_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  created_at: { type: Date, default: Date.now }
});

blockSchema.index({ blocker_id: 1, blocked_id: 1 }, { unique: true });

const reportSchema = new mongoose.Schema({
  reporter_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  reported_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ["pending", "reviewed"], default: "pending" },
  note: { type: String, default: "" },
  reviewed_at: { type: Date, default: null },
  reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  created_at: { type: Date, default: Date.now }
});

const superlikeSchema = new mongoose.Schema({
  from_user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  to_user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  created_at: { type: Date, default: Date.now }
});

superlikeSchema.index({ from_user_id: 1, to_user_id: 1 }, { unique: true });

const boostSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  starts_at: { type: Date, required: true },
  ends_at: { type: Date, required: true }
});

const photoVerificationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, required: true },
  photo_url: { type: String, default: null },
  submitted_at: { type: Date, default: Date.now },
  reviewed_at: { type: Date, default: null },
  reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  note: { type: String, default: "" }
});

const profileViewSchema = new mongoose.Schema({
  viewer_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  viewed_user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  viewed_at: { type: Date, default: Date.now }
});

profileViewSchema.index({ viewer_id: 1, viewed_user_id: 1, viewed_at: -1 });


const User = mongoose.model("User", userSchema);
const Otp = mongoose.model("Otp", otpSchema);
const Like = mongoose.model("Like", likeSchema);
const Match = mongoose.model("Match", matchSchema);
const Message = mongoose.model("Message", messageSchema);
const Block = mongoose.model("Block", blockSchema);
const Report = mongoose.model("Report", reportSchema);
const Superlike = mongoose.model("Superlike", superlikeSchema);
const Boost = mongoose.model("Boost", boostSchema);
const PhotoVerification = mongoose.model("PhotoVerification", photoVerificationSchema);
const ProfileView = mongoose.model("ProfileView", profileViewSchema);

module.exports = {
  connectDB,
  models: {
    User,
    Otp,
    Like,
    Match,
    Message,
    Block,
    Report,
    Superlike,
    Boost,
    PhotoVerification,
    ProfileView
  }
};
