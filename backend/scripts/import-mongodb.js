require("dotenv").config();
const crypto = require("crypto");
const { MongoClient } = require("mongodb");
const { connectDB, sequelize, models } = require("../src/db");

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const readArgValue = (name) => {
  const prefix = `${name}=`;
  const hit = args.find((item) => item.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
};

const mongoUri = readArgValue("--mongo-uri")
  || process.env.MONGO_SOURCE_URI
  || process.env.MONGODB_URI
  || null;
const mongoDbName = readArgValue("--mongo-db") || process.env.MONGO_SOURCE_DB || null;
const force = hasFlag("--force");

const collectionAliases = {
  users: ["users", "user"],
  otps: ["otps", "otp"],
  likes: ["likes", "like"],
  matches: ["matches", "match"],
  messages: ["messages", "message"],
  blocks: ["blocks", "block"],
  reports: ["reports", "report"],
  superlikes: ["superlikes", "superlike"],
  boosts: ["boosts", "boost"],
  photoVerifications: ["photoverifications", "photo_verifications", "photoverification"],
  profileViews: ["profileviews", "profile_views", "profileview"]
};

const targetModels = [
  models.User,
  models.Otp,
  models.Like,
  models.Match,
  models.Message,
  models.Block,
  models.Report,
  models.Superlike,
  models.Boost,
  models.PhotoVerification,
  models.ProfileView
];

const destroyOrder = [
  models.Message,
  models.ProfileView,
  models.PhotoVerification,
  models.Report,
  models.Block,
  models.Superlike,
  models.Boost,
  models.Match,
  models.Like,
  models.Otp,
  models.User
];

const toId = (value) => (value ? String(value) : null);

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const createIdMap = () => new Map();

const getMappedId = (map, value) => {
  const key = toId(value);
  return key ? map.get(key) || null : null;
};

const generateId = () => crypto.randomUUID();

const getCollectionMap = async (db) => {
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  return new Map(collections.map((entry) => [String(entry.name).toLowerCase(), entry.name]));
};

const resolveCollectionName = (available, aliases) => {
  for (const alias of aliases) {
    const hit = available.get(String(alias).toLowerCase());
    if (hit) return hit;
  }
  return null;
};

const loadDocuments = async (db, available, aliases, label) => {
  const name = resolveCollectionName(available, aliases);
  if (!name) {
    process.stdout.write(`Skipping ${label}: source collection not found\n`);
    return [];
  }
  return db.collection(name).find({}).toArray();
};

const ensureTargetIsSafe = async () => {
  const counts = await Promise.all(targetModels.map((model) => model.count()));
  const occupied = counts
    .map((count, index) => ({ count, name: targetModels[index].name }))
    .filter((row) => row.count > 0);

  if (occupied.length === 0) return;

  if (!force) {
    const summary = occupied.map((row) => `${row.name}=${row.count}`).join(", ");
    throw new Error(
      `MariaDB contains existing data (${summary}). Re-run with --force to clear target tables before import.`
    );
  }

  await sequelize.transaction(async (transaction) => {
    for (const model of destroyOrder) {
      await model.destroy({ where: {}, transaction });
    }
  });
};

const dedupeRows = (rows, makeKey) => {
  const seen = new Set();
  const result = [];
  for (const row of rows) {
    const key = makeKey(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result;
};

const importUsers = async (docs, transaction, userMap) => {
  const rows = docs.map((doc) => {
    const id = generateId();
    userMap.set(String(doc._id), id);
    return {
      id,
      email: doc.email || null,
      phone: doc.phone || null,
      password_hash: doc.password_hash,
      role: doc.role || "user",
      suspended: !!doc.suspended,
      name: doc.name,
      birthdate: doc.birthdate,
      gender: doc.gender,
      location: doc.location,
      location_city: doc.location_city || "",
      location_lat: Number.isFinite(doc.location_lat) ? doc.location_lat : null,
      location_lng: Number.isFinite(doc.location_lng) ? doc.location_lng : null,
      location_updated_at: toDate(doc.location_updated_at),
      children_count: Number.isInteger(doc.children_count) ? doc.children_count : null,
      smoker: typeof doc.smoker === "boolean" ? doc.smoker : null,
      religion: doc.religion || null,
      profession: doc.profession || "",
      education_level: doc.education_level || "",
      height_cm: Number.isFinite(doc.height_cm) ? Math.round(doc.height_cm) : null,
      family_status: doc.family_status || "",
      languages: toArray(doc.languages),
      looking_for: doc.looking_for || "",
      interests: toArray(doc.interests),
      bio: doc.bio || "",
      photos: toArray(doc.photos),
      pref_age_min: Number.isFinite(doc.pref_age_min) ? Math.round(doc.pref_age_min) : 18,
      pref_age_max: Number.isFinite(doc.pref_age_max) ? Math.round(doc.pref_age_max) : 99,
      pref_distance_km: Number.isFinite(doc.pref_distance_km) ? Math.round(doc.pref_distance_km) : 50,
      pref_gender: doc.pref_gender || "any",
      verified: !!doc.verified,
      verified_photo: !!doc.verified_photo,
      reverification_required: !!doc.reverification_required,
      premium: !!doc.premium,
      incognito_mode: !!doc.incognito_mode,
      boost_ends_at: toDate(doc.boost_ends_at),
      views_count: Number.isFinite(doc.views_count) ? Math.round(doc.views_count) : 0,
      last_active_at: toDate(doc.last_active_at),
      onboarding_completed: !!doc.onboarding_completed,
      created_at: toDate(doc.created_at) || new Date()
    };
  });

  if (rows.length > 0) {
    await models.User.bulkCreate(rows, { transaction });
  }
  return { inserted: rows.length, skipped: 0 };
};

const importMatches = async (docs, transaction, userMap, matchMap) => {
  let skipped = 0;
  const pairToId = new Map();
  const rows = [];

  for (const doc of docs) {
    const user1 = getMappedId(userMap, doc.user1_id);
    const user2 = getMappedId(userMap, doc.user2_id);
    if (!user1 || !user2) {
      skipped += 1;
      continue;
    }

    const [user1_id, user2_id] = String(user1) < String(user2) ? [user1, user2] : [user2, user1];
    const pairKey = `${user1_id}:${user2_id}`;
    const existingId = pairToId.get(pairKey);

    if (existingId) {
      matchMap.set(String(doc._id), existingId);
      skipped += 1;
      continue;
    }

    const id = generateId();
    pairToId.set(pairKey, id);
    matchMap.set(String(doc._id), id);
    rows.push({
      id,
      user1_id,
      user2_id,
      created_at: toDate(doc.created_at) || new Date()
    });
  }

  if (rows.length > 0) {
    await models.Match.bulkCreate(rows, { transaction });
  }

  return { inserted: rows.length, skipped };
};

const importChildRows = async ({
  docs,
  transaction,
  mapRow,
  model,
  makeDedupeKey
}) => {
  let skipped = 0;
  const mapped = [];

  for (const doc of docs) {
    const row = mapRow(doc);
    if (!row) {
      skipped += 1;
      continue;
    }
    mapped.push(row);
  }

  const rows = makeDedupeKey ? dedupeRows(mapped, makeDedupeKey) : mapped;
  if (rows.length > 0) {
    await model.bulkCreate(rows, { transaction });
  }

  return {
    inserted: rows.length,
    skipped: skipped + (mapped.length - rows.length)
  };
};

const run = async () => {
  if (!mongoUri) {
    throw new Error("Missing MongoDB source URI. Set MONGO_SOURCE_URI or pass --mongo-uri=...");
  }

  await connectDB();
  await ensureTargetIsSafe();

  const mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();

  try {
    const sourceDb = mongoDbName ? mongoClient.db(mongoDbName) : mongoClient.db();
    const availableCollections = await getCollectionMap(sourceDb);
    const docsByCollection = {
      users: await loadDocuments(sourceDb, availableCollections, collectionAliases.users, "users"),
      otps: await loadDocuments(sourceDb, availableCollections, collectionAliases.otps, "otps"),
      likes: await loadDocuments(sourceDb, availableCollections, collectionAliases.likes, "likes"),
      matches: await loadDocuments(sourceDb, availableCollections, collectionAliases.matches, "matches"),
      messages: await loadDocuments(sourceDb, availableCollections, collectionAliases.messages, "messages"),
      blocks: await loadDocuments(sourceDb, availableCollections, collectionAliases.blocks, "blocks"),
      reports: await loadDocuments(sourceDb, availableCollections, collectionAliases.reports, "reports"),
      superlikes: await loadDocuments(sourceDb, availableCollections, collectionAliases.superlikes, "superlikes"),
      boosts: await loadDocuments(sourceDb, availableCollections, collectionAliases.boosts, "boosts"),
      photoVerifications: await loadDocuments(sourceDb, availableCollections, collectionAliases.photoVerifications, "photoVerifications"),
      profileViews: await loadDocuments(sourceDb, availableCollections, collectionAliases.profileViews, "profileViews")
    };

    const userMap = createIdMap();
    const matchMap = createIdMap();

    const results = {};

    await sequelize.transaction(async (transaction) => {
      results.users = await importUsers(docsByCollection.users, transaction, userMap);

      results.otps = await importChildRows({
        docs: docsByCollection.otps,
        transaction,
        model: models.Otp,
        mapRow: (doc) => {
          const userId = getMappedId(userMap, doc.user_id);
          if (!userId) return null;
          return {
            id: generateId(),
            user_id: userId,
            code: String(doc.code || ""),
            expires_at: toDate(doc.expires_at) || new Date(),
            verified: !!doc.verified,
            created_at: toDate(doc.created_at) || new Date()
          };
        }
      });

      results.likes = await importChildRows({
        docs: docsByCollection.likes,
        transaction,
        model: models.Like,
        makeDedupeKey: (row) => `${row.from_user_id}:${row.to_user_id}`,
        mapRow: (doc) => {
          const fromUserId = getMappedId(userMap, doc.from_user_id);
          const toUserId = getMappedId(userMap, doc.to_user_id);
          if (!fromUserId || !toUserId) return null;
          return {
            id: generateId(),
            from_user_id: fromUserId,
            to_user_id: toUserId,
            status: String(doc.status || "like"),
            created_at: toDate(doc.created_at) || new Date()
          };
        }
      });

      results.matches = await importMatches(docsByCollection.matches, transaction, userMap, matchMap);

      results.messages = await importChildRows({
        docs: docsByCollection.messages,
        transaction,
        model: models.Message,
        mapRow: (doc) => {
          const matchId = getMappedId(matchMap, doc.match_id);
          const fromUserId = getMappedId(userMap, doc.from_user_id);
          const toUserId = getMappedId(userMap, doc.to_user_id);
          if (!matchId || !fromUserId || !toUserId) return null;
          return {
            id: generateId(),
            match_id: matchId,
            from_user_id: fromUserId,
            to_user_id: toUserId,
            type: doc.type || "text",
            content: doc.content || null,
            media_url: doc.media_url || null,
            delivered_at: toDate(doc.delivered_at),
            read_at: toDate(doc.read_at),
            listened_at: toDate(doc.listened_at),
            created_at: toDate(doc.created_at) || new Date()
          };
        }
      });

      results.blocks = await importChildRows({
        docs: docsByCollection.blocks,
        transaction,
        model: models.Block,
        makeDedupeKey: (row) => `${row.blocker_id}:${row.blocked_id}`,
        mapRow: (doc) => {
          const blockerId = getMappedId(userMap, doc.blocker_id);
          const blockedId = getMappedId(userMap, doc.blocked_id);
          if (!blockerId || !blockedId) return null;
          return {
            id: generateId(),
            blocker_id: blockerId,
            blocked_id: blockedId,
            created_at: toDate(doc.created_at) || new Date()
          };
        }
      });

      results.reports = await importChildRows({
        docs: docsByCollection.reports,
        transaction,
        model: models.Report,
        mapRow: (doc) => {
          const reporterId = getMappedId(userMap, doc.reporter_id);
          const reportedId = getMappedId(userMap, doc.reported_id);
          if (!reporterId || !reportedId) return null;
          return {
            id: generateId(),
            reporter_id: reporterId,
            reported_id: reportedId,
            reason: String(doc.reason || ""),
            status: doc.status === "reviewed" ? "reviewed" : "pending",
            note: doc.note || "",
            reviewed_at: toDate(doc.reviewed_at),
            reviewed_by: getMappedId(userMap, doc.reviewed_by),
            created_at: toDate(doc.created_at) || new Date()
          };
        }
      });

      results.superlikes = await importChildRows({
        docs: docsByCollection.superlikes,
        transaction,
        model: models.Superlike,
        makeDedupeKey: (row) => `${row.from_user_id}:${row.to_user_id}`,
        mapRow: (doc) => {
          const fromUserId = getMappedId(userMap, doc.from_user_id);
          const toUserId = getMappedId(userMap, doc.to_user_id);
          if (!fromUserId || !toUserId) return null;
          return {
            id: generateId(),
            from_user_id: fromUserId,
            to_user_id: toUserId,
            created_at: toDate(doc.created_at) || new Date()
          };
        }
      });

      results.boosts = await importChildRows({
        docs: docsByCollection.boosts,
        transaction,
        model: models.Boost,
        mapRow: (doc) => {
          const userId = getMappedId(userMap, doc.user_id);
          if (!userId) return null;
          return {
            id: generateId(),
            user_id: userId,
            starts_at: toDate(doc.starts_at) || new Date(),
            ends_at: toDate(doc.ends_at) || new Date()
          };
        }
      });

      results.photoVerifications = await importChildRows({
        docs: docsByCollection.photoVerifications,
        transaction,
        model: models.PhotoVerification,
        mapRow: (doc) => {
          const userId = getMappedId(userMap, doc.user_id);
          if (!userId) return null;
          return {
            id: generateId(),
            user_id: userId,
            status: String(doc.status || "pending"),
            photo_url: doc.photo_url || null,
            submitted_at: toDate(doc.submitted_at) || new Date(),
            reviewed_at: toDate(doc.reviewed_at),
            reviewed_by: getMappedId(userMap, doc.reviewed_by),
            note: doc.note || ""
          };
        }
      });

      results.profileViews = await importChildRows({
        docs: docsByCollection.profileViews,
        transaction,
        model: models.ProfileView,
        mapRow: (doc) => {
          const viewerId = getMappedId(userMap, doc.viewer_id);
          const viewedUserId = getMappedId(userMap, doc.viewed_user_id);
          if (!viewerId || !viewedUserId) return null;
          return {
            id: generateId(),
            viewer_id: viewerId,
            viewed_user_id: viewedUserId,
            viewed_at: toDate(doc.viewed_at) || new Date()
          };
        }
      });
    });

    process.stdout.write("MongoDB -> MariaDB import completed\n");
    for (const [name, stats] of Object.entries(results)) {
      process.stdout.write(`- ${name}: inserted=${stats.inserted}, skipped=${stats.skipped}\n`);
    }
    process.stdout.write("\n");
    process.stdout.write("Usage examples:\n");
    process.stdout.write("npm run import:mongo -- --mongo-uri=mongodb://127.0.0.1:27017/loveconnect\n");
    process.stdout.write("npm run import:mongo -- --mongo-uri=... --mongo-db=loveconnect --force\n");
  } finally {
    await mongoClient.close();
  }
};

run().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
