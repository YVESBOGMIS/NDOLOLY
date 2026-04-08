const { Sequelize, DataTypes, Model, Op } = require("sequelize");

const buildJsonArrayField = (fieldName) => ({
  type: DataTypes.TEXT,
  allowNull: false,
  defaultValue: "[]",
  get() {
    const raw = this.getDataValue(fieldName);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  },
  set(value) {
    const normalized = Array.isArray(value) ? value : [];
    this.setDataValue(fieldName, JSON.stringify(normalized));
  }
});

class BaseModel extends Model {
  toJSON() {
    const values = { ...this.get() };
    values._id = values.id;
    return values;
  }
}

const databaseUrl = process.env.DATABASE_URL || process.env.MARIADB_URL || null;
const logging = process.env.DB_LOGGING === "true" ? console.log : false;

const sequelize = databaseUrl
  ? new Sequelize(databaseUrl, {
    dialect: "mariadb",
    logging,
    dialectOptions: process.env.DB_SSL === "true" ? { ssl: { rejectUnauthorized: false } } : {}
  })
  : new Sequelize(
    process.env.DB_NAME || "loveconnect",
    process.env.DB_USER || "root",
    process.env.DB_PASSWORD || "",
    {
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 3306),
      dialect: "mariadb",
      logging,
      dialectOptions: process.env.DB_SSL === "true" ? { ssl: { rejectUnauthorized: false } } : {}
    }
  );

const commonModelOptions = {
  sequelize,
  freezeTableName: true,
  underscored: true,
  timestamps: false
};

const idField = {
  type: DataTypes.UUID,
  primaryKey: true,
  defaultValue: DataTypes.UUIDV4
};

class User extends BaseModel {}
User.init({
  id: idField,
  email: { type: DataTypes.STRING, allowNull: true, unique: true },
  phone: { type: DataTypes.STRING, allowNull: true, unique: true },
  password_hash: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM("user", "admin"), allowNull: false, defaultValue: "user" },
  suspended: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  name: { type: DataTypes.STRING, allowNull: false },
  birthdate: { type: DataTypes.STRING, allowNull: false },
  gender: { type: DataTypes.STRING, allowNull: false },
  location: { type: DataTypes.STRING, allowNull: false },
  location_city: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
  location_lat: { type: DataTypes.DOUBLE, allowNull: true, defaultValue: null },
  location_lng: { type: DataTypes.DOUBLE, allowNull: true, defaultValue: null },
  location_updated_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
  children_count: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
  smoker: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: null },
  religion: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
  profession: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
  education_level: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
  height_cm: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
  family_status: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
  languages: buildJsonArrayField("languages"),
  looking_for: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
  interests: buildJsonArrayField("interests"),
  bio: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
  photos: buildJsonArrayField("photos"),
  pref_age_min: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 18 },
  pref_age_max: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 99 },
  pref_distance_km: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 50 },
  pref_gender: { type: DataTypes.STRING, allowNull: false, defaultValue: "any" },
  verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  verified_photo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  reverification_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  premium: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  incognito_mode: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  boost_ends_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
  views_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  last_active_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
  onboarding_completed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  ...commonModelOptions,
  indexes: [
    { unique: true, fields: ["email"] },
    { unique: true, fields: ["phone"] }
  ]
});

class Otp extends BaseModel {}
Otp.init({
  id: idField,
  user_id: { type: DataTypes.UUID, allowNull: false, references: { model: "User", key: "id" }, onDelete: "CASCADE" },
  code: { type: DataTypes.STRING, allowNull: false },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, commonModelOptions);

class Like extends BaseModel {}
Like.init({
  id: idField,
  from_user_id: { type: DataTypes.UUID, allowNull: false, references: { model: "User", key: "id" }, onDelete: "CASCADE" },
  to_user_id: { type: DataTypes.UUID, allowNull: false, references: { model: "User", key: "id" }, onDelete: "CASCADE" },
  status: { type: DataTypes.STRING, allowNull: false },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  ...commonModelOptions,
  indexes: [
    { unique: true, fields: ["from_user_id", "to_user_id"] }
  ]
});

class Match extends BaseModel {}
Match.init({
  id: idField,
  user1_id: { type: DataTypes.UUID, allowNull: false, references: { model: "User", key: "id" }, onDelete: "CASCADE" },
  user2_id: { type: DataTypes.UUID, allowNull: false, references: { model: "User", key: "id" }, onDelete: "CASCADE" },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  ...commonModelOptions,
  indexes: [
    { unique: true, fields: ["user1_id", "user2_id"] }
  ]
});

class Message extends BaseModel {}
Message.init({
  id: idField,
  match_id: { type: DataTypes.UUID, allowNull: false, references: { model: "Match", key: "id" }, onDelete: "CASCADE" },
  from_user_id: { type: DataTypes.UUID, allowNull: false, references: { model: "User", key: "id" }, onDelete: "CASCADE" },
  to_user_id: { type: DataTypes.UUID, allowNull: false, references: { model: "User", key: "id" }, onDelete: "CASCADE" },
  type: { type: DataTypes.STRING, allowNull: false, defaultValue: "text" },
  content: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
  media_url: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
  delivered_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
  read_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
  listened_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, commonModelOptions);

class Block extends BaseModel {}
Block.init({
  id: idField,
  blocker_id: { type: DataTypes.UUID, allowNull: false, references: { model: "User", key: "id" }, onDelete: "CASCADE" },
  blocked_id: { type: DataTypes.UUID, allowNull: false, references: { model: "User", key: "id" }, onDelete: "CASCADE" },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  ...commonModelOptions,
  indexes: [
    { unique: true, fields: ["blocker_id", "blocked_id"] }
  ]
});

class Report extends BaseModel {}
Report.init({
  id: idField,
  reporter_id: { type: DataTypes.UUID, allowNull: false, references: { model: "User", key: "id" }, onDelete: "CASCADE" },
  reported_id: { type: DataTypes.UUID, allowNull: false, references: { model: "User", key: "id" }, onDelete: "CASCADE" },
  reason: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.ENUM("pending", "reviewed"), allowNull: false, defaultValue: "pending" },
  note: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
  reviewed_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
  reviewed_by: { type: DataTypes.UUID, allowNull: true, defaultValue: null, references: { model: "User", key: "id" }, onDelete: "SET NULL" },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, commonModelOptions);

class Superlike extends BaseModel {}
Superlike.init({
  id: idField,
  from_user_id: { type: DataTypes.UUID, allowNull: false, references: { model: "User", key: "id" }, onDelete: "CASCADE" },
  to_user_id: { type: DataTypes.UUID, allowNull: false, references: { model: "User", key: "id" }, onDelete: "CASCADE" },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  ...commonModelOptions,
  indexes: [
    { unique: true, fields: ["from_user_id", "to_user_id"] }
  ]
});

class Boost extends BaseModel {}
Boost.init({
  id: idField,
  user_id: { type: DataTypes.UUID, allowNull: false, references: { model: "User", key: "id" }, onDelete: "CASCADE" },
  starts_at: { type: DataTypes.DATE, allowNull: false },
  ends_at: { type: DataTypes.DATE, allowNull: false }
}, commonModelOptions);

class PhotoVerification extends BaseModel {}
PhotoVerification.init({
  id: idField,
  user_id: { type: DataTypes.UUID, allowNull: false, references: { model: "User", key: "id" }, onDelete: "CASCADE" },
  status: { type: DataTypes.STRING, allowNull: false },
  photo_url: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
  submitted_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  reviewed_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
  reviewed_by: { type: DataTypes.UUID, allowNull: true, defaultValue: null, references: { model: "User", key: "id" }, onDelete: "SET NULL" },
  note: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" }
}, commonModelOptions);

class ProfileView extends BaseModel {}
ProfileView.init({
  id: idField,
  viewer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "User", key: "id" }, onDelete: "CASCADE" },
  viewed_user_id: { type: DataTypes.UUID, allowNull: false, references: { model: "User", key: "id" }, onDelete: "CASCADE" },
  viewed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  ...commonModelOptions,
  indexes: [
    { fields: ["viewer_id", "viewed_user_id", "viewed_at"] }
  ]
});

const models = {
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
};

let hasConnected = false;

const connectDB = async () => {
  if (hasConnected) return sequelize;
  await sequelize.authenticate();
  await sequelize.sync();
  hasConnected = true;
  return sequelize;
};

module.exports = {
  connectDB,
  sequelize,
  Op,
  models
};
