const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs/promises");
const { models, Op } = require("../db");
const { auth } = require("../middleware/auth");

const router = express.Router();

const uploadsDir = path.join(__dirname, "..", "..", "uploads");

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const safeExt = ext && ext.length <= 8 ? ext.toLowerCase() : "";
    const base = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${base}${safeExt}`);
  }
});

const upload = multer({ storage });
const allowedReligions = new Set(["catholique", "protestant", "musulman"]);
const CITY_OPTIONS = [
  "Bafang",
  "Bafia",
  "Bafoussam",
  "Bali",
  "Bamenda",
  "Banyo",
  "Batouri",
  "Bertoua",
  "Buea",
  "Dibombari",
  "Dizangue",
  "Djoum",
  "Douala",
  "Dschang",
  "Ebolowa",
  "Edea",
  "Foumban",
  "Foumbot",
  "Fundong",
  "Garoua",
  "Guider",
  "Kaele",
  "Kousseri",
  "Kribi",
  "Kumba",
  "Limbe",
  "Loum",
  "Mbalmayo",
  "Mbanga",
  "Mbouda",
  "Meiganga",
  "Mokolo",
  "Mora",
  "Mundemba",
  "Nanga Eboko",
  "Ndop",
  "Ngaoundere",
  "Nkambe",
  "Nkongsamba",
  "Obala",
  "Okola",
  "Saa",
  "Sangmelima",
  "Tibati",
  "Tiko",
  "Wum",
  "Yaounde"
];

const computeAge = (birthdate) => {
  const dob = new Date(birthdate);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age;
};

const toRadians = (value) => (Number(value) * Math.PI) / 180;

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const r = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return r * c;
};

const normalizeCity = (value) => String(value || "").trim().toLowerCase();

const extractCity = (address = {}) => (
  address.city
  || address.town
  || address.village
  || address.municipality
  || address.county
  || address.state
  || ""
);

const reverseGeocodeCity = async (lat, lng) => {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "NDOLOLY/1.0 (support@ndololy.local)"
    }
  });
  if (!response.ok) return null;
  const data = await response.json();
  const city = extractCity(data?.address);
  return city || null;
};

const pickCityName = (item) => {
  if (!item) return null;
  const city = extractCity(item.address || {});
  if (city) return city;
  if (item.display_name) {
    return String(item.display_name).split(",")[0].trim();
  }
  return null;
};

const searchCitiesCameroon = async (query) => {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&countrycodes=cm&q=${encodeURIComponent(
    query
  )}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "NDOLOLY/1.0 (support@ndololy.local)"
    }
  });
  if (!response.ok) return [];
  const data = await response.json();
  if (!Array.isArray(data)) return [];
  const seen = new Set();
  const results = [];
  for (const item of data) {
    const name = pickCityName(item);
    if (!name) continue;
    const key = normalizeCity(name);
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(name);
  }
  return results;
};

const safeRemoveUpload = async (photoPath) => {
  if (!photoPath || typeof photoPath !== "string") return;
  if (!photoPath.startsWith("/uploads/")) return;
  const filename = path.basename(photoPath);
  const fullPath = path.join(uploadsDir, filename);
  try {
    await fs.unlink(fullPath);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("Failed to delete upload:", err.message);
    }
  }
};

const buildDistance = (viewer, target, fallback = 50) => {
  const hasCoords = Number.isFinite(viewer?.location_lat)
    && Number.isFinite(viewer?.location_lng)
    && Number.isFinite(target?.location_lat)
    && Number.isFinite(target?.location_lng);
  if (hasCoords) {
    const distance = haversineKm(
      viewer.location_lat,
      viewer.location_lng,
      target.location_lat,
      target.location_lng
    );
    return Math.max(1, Math.round(distance));
  }
  const max = Number(viewer?.pref_distance_km || fallback);
  if (!Number.isFinite(max) || max <= 0) return Math.max(1, Math.floor(Math.random() * 50));
  return Math.max(1, Math.floor(Math.random() * max));
};

const normalizeChildrenCount = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.floor(parsed);
};

const normalizeSmoker = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (value === true || value === "true" || value === "yes" || value === "1") return true;
  if (value === false || value === "false" || value === "no" || value === "0") return false;
  return undefined;
};

const normalizeReligion = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).toLowerCase().trim();
  if (!allowedReligions.has(normalized)) return undefined;
  return normalized;
};

const serializeVerification = (row) => {
  const raw = row?.toJSON ? row.toJSON() : row;
  if (!raw) return null;
  return {
    id: raw.id,
    _id: raw.id,
    status: raw.status,
    note: raw.note || "",
    photo_url: raw.photo_url || null,
    submitted_at: raw.submitted_at,
    reviewed_at: raw.reviewed_at
  };
};

const toPlainList = (rows) => rows.map((row) => (row?.toJSON ? row.toJSON() : row));

router.get("/me", auth, async (req, res) => {
  const [user, verification] = await Promise.all([
    models.User.findByPk(req.user.id),
    models.PhotoVerification.findOne({
      where: { user_id: req.user.id },
      order: [["submitted_at", "DESC"]]
    })
  ]);
  if (!user) return res.status(404).json({ error: "User not found" });

  const payload = user.toJSON();
  delete payload.password_hash;
  payload.incognito_mode = !!user.premium && !!user.incognito_mode;
  payload.photo_verification = serializeVerification(verification);
  return res.json(payload);
});

router.get("/verification-status", auth, async (req, res) => {
  const user = await models.User.findByPk(req.user.id, {
    attributes: ["id", "verified_photo"]
  });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const verification = await models.PhotoVerification.findOne({
    where: { user_id: req.user.id },
    order: [["submitted_at", "DESC"]]
  });

  const serialized = serializeVerification(verification);
  if (user.verified_photo) {
    return res.json({
      status: "approved",
      verification: serialized
        ? { ...serialized, status: "approved" }
        : null
    });
  }

  if (serialized?.status === "approved") {
    return res.json({
      status: "rejected",
      verification: {
        ...serialized,
        status: "rejected",
        note: serialized.note || "Validation retiree par l'administration."
      }
    });
  }

  return res.json({
    status: verification?.status || "none",
    verification: serialized
  });
});

router.get("/cities", async (req, res) => {
  const query = String(req.query?.q || "").trim();
  if (!query) return res.json({ cities: [] });

  try {
    const cities = await searchCitiesCameroon(query);
    if (cities.length > 0) {
      return res.json({ cities });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("City search failed:", err.message);
  }

  const fallback = CITY_OPTIONS
    .filter((city) => city.toLowerCase().startsWith(query.toLowerCase()))
    .slice(0, 8);
  return res.json({ cities: fallback });
});

router.post("/location", auth, async (req, res) => {
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return res.status(400).json({ error: "Invalid latitude" });
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return res.status(400).json({ error: "Invalid longitude" });
  }

  const user = await models.User.findByPk(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  let city = null;
  try {
    city = await reverseGeocodeCity(lat, lng);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Reverse geocoding failed:", err.message);
  }

  user.location_lat = lat;
  user.location_lng = lng;
  user.location_updated_at = new Date();
  if (city) {
    user.location_city = normalizeCity(city);
    user.location = city;
  }

  await user.save();
  return res.json({ message: "Location updated", city: city || null });
});

router.put("/me", auth, async (req, res) => {
  const updates = req.body || {};
  const allowed = [
    "name",
    "birthdate",
    "gender",
    "location",
    "children_count",
    "smoker",
    "religion",
    "profession",
    "education_level",
    "height_cm",
    "family_status",
    "languages",
    "looking_for",
    "interests",
    "bio",
    "pref_age_min",
    "pref_age_max",
    "pref_distance_km",
    "pref_gender",
    "incognito_mode"
  ];

  const user = await models.User.findByPk(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  let changed = false;
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      if (key === "interests") {
        user[key] = Array.isArray(updates[key]) ? updates[key] : [];
      } else if (key === "languages") {
        user[key] = Array.isArray(updates[key]) ? updates[key] : [];
      } else if (key === "children_count") {
        const normalized = normalizeChildrenCount(updates[key]);
        if (normalized === undefined) {
          return res.status(400).json({ error: "Invalid children count" });
        }
        user[key] = normalized;
      } else if (key === "smoker") {
        const normalized = normalizeSmoker(updates[key]);
        if (normalized === undefined) {
          return res.status(400).json({ error: "Invalid smoker value" });
        }
        user[key] = normalized;
      } else if (key === "religion") {
        const normalized = normalizeReligion(updates[key]);
        if (normalized === undefined) {
          return res.status(400).json({ error: "Invalid religion value" });
        }
        user[key] = normalized;
      } else if (key === "height_cm") {
        if (updates[key] === null || updates[key] === "" || updates[key] === undefined) {
          user[key] = null;
        } else {
          const parsed = Number(updates[key]);
          if (!Number.isFinite(parsed) || parsed <= 0) {
            return res.status(400).json({ error: "Invalid height" });
          }
          user[key] = Math.round(parsed);
        }
      } else if (key === "incognito_mode") {
        if (!user.premium && Boolean(updates[key])) {
          return res.status(403).json({
            error: "Premium required for incognito mode",
            premium_required: true
          });
        }
        user.incognito_mode = !!user.premium && Boolean(updates[key]);
      } else {
        user[key] = updates[key];
      }
      changed = true;
    }
  }

  if (!changed) {
    return res.status(400).json({ error: "No valid updates" });
  }

  await user.save();
  return res.json({ message: "Profile updated" });
});

router.delete("/me", auth, async (req, res) => {
  await models.User.destroy({ where: { id: req.user.id } });
  return res.json({ message: "Account deleted" });
});

router.post("/photo", auth, upload.single("photo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });

  const user = await models.User.findByPk(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  if ((user.photos || []).length >= 6) {
    return res.status(400).json({ error: "Maximum 6 photos" });
  }

  const urlPath = `/uploads/${req.file.filename}`;
  user.photos = [...(user.photos || []), urlPath];
  await user.save();

  return res.json({ message: "Photo added", photo: urlPath });
});

router.put("/photo", auth, upload.single("photo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const oldPhoto = req.body?.oldPhoto || req.body?.old_photo;
  if (!oldPhoto) return res.status(400).json({ error: "Missing old photo" });

  const user = await models.User.findByPk(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  const photos = user.photos || [];
  const index = photos.indexOf(oldPhoto);
  if (index === -1) return res.status(404).json({ error: "Photo not found" });

  const urlPath = `/uploads/${req.file.filename}`;
  photos[index] = urlPath;
  user.photos = photos;
  await user.save();

  await safeRemoveUpload(oldPhoto);
  return res.json({ message: "Photo updated", photo: urlPath });
});

router.delete("/photo", auth, async (req, res) => {
  const photo = req.body?.photo;
  if (!photo) return res.status(400).json({ error: "Missing photo" });

  const user = await models.User.findByPk(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  const photos = user.photos || [];
  if (!photos.includes(photo)) {
    return res.status(404).json({ error: "Photo not found" });
  }

  user.photos = photos.filter((item) => item !== photo);
  await user.save();

  await safeRemoveUpload(photo);
  return res.json({ message: "Photo deleted" });
});

router.post("/verify-request", auth, upload.single("photo"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Verification photo required" });
  }

  const user = await models.User.findByPk(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  const existing = await models.PhotoVerification.findOne({
    where: { user_id: req.user.id },
    order: [["submitted_at", "DESC"]]
  });
  if (existing && existing.status === "pending") {
    return res.status(409).json({ error: "Verification already pending" });
  }

  const verification = await models.PhotoVerification.create({
    user_id: req.user.id,
    status: "pending",
    photo_url: `/uploads/${req.file.filename}`,
    note: ""
  });

  user.verified_photo = false;
  user.reverification_required = false;
  await user.save();

  return res.json({
    message: "Verification soumise a l'admin",
    verification: serializeVerification(verification)
  });
});

router.post("/complete-onboarding", auth, async (req, res) => {
  await models.User.update(
    { onboarding_completed: true },
    { where: { id: req.user.id } }
  );
  return res.json({ message: "Onboarding completed" });
});

router.get("/discover", auth, async (req, res) => {
  const meRecord = await models.User.findByPk(req.user.id);
  if (!meRecord) return res.status(404).json({ error: "User not found" });
  const me = meRecord.toJSON();

  const [blockedIdsRows, blockedByIdsRows, likedIdsRows, usersRows] = await Promise.all([
    models.Block.findAll({ where: { blocker_id: req.user.id }, attributes: ["blocked_id"] }),
    models.Block.findAll({ where: { blocked_id: req.user.id }, attributes: ["blocker_id"] }),
    models.Like.findAll({ where: { from_user_id: req.user.id }, attributes: ["to_user_id"] }),
    models.User.findAll({
      where: {
        id: { [Op.ne]: req.user.id },
        verified: true,
        verified_photo: true,
        suspended: { [Op.ne]: true }
      }
    })
  ]);

  const blockedSet = new Set(blockedIdsRows.map((row) => String(row.blocked_id)));
  const blockedBySet = new Set(blockedByIdsRows.map((row) => String(row.blocker_id)));
  const likedSet = new Set(likedIdsRows.map((row) => String(row.to_user_id)));
  const users = toPlainList(usersRows);
  const meInterests = me.interests || [];

  const filterAgeMin = Number.isFinite(Number(req.query?.age_min)) ? Number(req.query.age_min) : null;
  const filterAgeMax = Number.isFinite(Number(req.query?.age_max)) ? Number(req.query.age_max) : null;
  const filterCity = typeof req.query?.city === "string" && req.query.city.trim()
    ? req.query.city.trim().toLowerCase()
    : null;
  const filterChildrenRaw = typeof req.query?.children === "string" ? req.query.children.trim().toLowerCase() : null;
  const filterSmokerRaw = typeof req.query?.smoker === "string" ? req.query.smoker.trim().toLowerCase() : null;
  const filterReligionRaw = typeof req.query?.religion === "string" ? req.query.religion.trim().toLowerCase() : null;

  const filterSmoker = filterSmokerRaw === "yes"
    ? true
    : filterSmokerRaw === "no"
      ? false
      : null;

  const filterReligion = filterReligionRaw && allowedReligions.has(filterReligionRaw)
    ? filterReligionRaw
    : null;

  let childrenExact = null;
  let childrenMin = null;
  if (filterChildrenRaw && filterChildrenRaw !== "any") {
    if (filterChildrenRaw === "3plus") {
      childrenMin = 3;
    } else if (Number.isFinite(Number(filterChildrenRaw))) {
      childrenExact = Math.floor(Number(filterChildrenRaw));
    }
  }

  const matchesExplicitFilters = (user, age) => {
    if (filterAgeMin !== null && age < filterAgeMin) return false;
    if (filterAgeMax !== null && age > filterAgeMax) return false;
    if (filterCity) {
      const loc = String(user.location || "").toLowerCase();
      if (!loc || !loc.includes(filterCity)) return false;
    }
    if (childrenMin !== null) {
      if (typeof user.children_count !== "number") return false;
      if (user.children_count < childrenMin) return false;
    }
    if (childrenExact !== null) {
      if (typeof user.children_count !== "number") return false;
      if (user.children_count !== childrenExact) return false;
    }
    if (filterSmoker !== null) {
      if (typeof user.smoker !== "boolean") return false;
      if (user.smoker !== filterSmoker) return false;
    }
    if (filterReligion) {
      if (!user.religion || String(user.religion).toLowerCase() !== filterReligion) return false;
    }
    return true;
  };

  const baseCandidates = users.filter((user) => {
    if (me.gender && user.gender && me.gender === user.gender) return false;
    if (blockedSet.has(String(user.id))) return false;
    if (blockedBySet.has(String(user.id))) return false;

    const age = computeAge(user.birthdate);
    if (age === null) return false;

    return true;
  });

  const applyPreferences = (list, options = {}) => {
    const { ignoreInterests = false, ignoreAge = false } = options;
    return list.filter((user) => {
      const age = computeAge(user.birthdate);
      if (age === null) return false;

      if (!ignoreAge) {
        if (age < me.pref_age_min || age > me.pref_age_max) return false;
      }
      if (me.pref_gender !== "any" && user.gender !== me.pref_gender) return false;
      if (!matchesExplicitFilters(user, age)) return false;

      if (ignoreInterests || meInterests.length === 0) return true;
      const theirInterests = user.interests || [];
      const sharedInterests = theirInterests.filter((item) => meInterests.includes(item));
      return sharedInterests.length > 0;
    });
  };

  let results = applyPreferences(baseCandidates).filter((user) => !likedSet.has(String(user.id)));

  if (results.length === 0) {
    results = applyPreferences(baseCandidates, { ignoreInterests: true })
      .filter((user) => !likedSet.has(String(user.id)));
  }

  if (results.length === 0) {
    results = applyPreferences(baseCandidates, { ignoreInterests: true, ignoreAge: true })
      .filter((user) => !likedSet.has(String(user.id)));
  }

  if (results.length === 0) {
    results = applyPreferences(baseCandidates, { ignoreInterests: true, ignoreAge: true });
  }

  const now = new Date();
  const payload = results
    .map((user) => ({
      id: user.id,
      _id: user.id,
      name: user.name,
      age: computeAge(user.birthdate),
      gender: user.gender,
      location: user.location,
      interests: user.interests || [],
      bio: user.bio,
      photos: user.photos || [],
      children_count: user.children_count ?? null,
      smoker: user.smoker ?? null,
      religion: user.religion ?? null,
      family_status: user.family_status || "",
      looking_for: user.looking_for || "",
      verified_photo: !!user.verified_photo,
      boost_ends_at: user.boost_ends_at
    }))
    .sort((a, b) => {
      const aBoost = a.boost_ends_at && new Date(a.boost_ends_at) > now;
      const bBoost = b.boost_ends_at && new Date(b.boost_ends_at) > now;
      return Number(bBoost) - Number(aBoost);
    });

  return res.json(payload);
});

router.get("/user/:id", auth, async (req, res) => {
  const targetId = req.params.id;
  if (!targetId) return res.status(400).json({ error: "User id required" });

  const viewerRecord = await models.User.findByPk(req.user.id);
  if (!viewerRecord) return res.status(404).json({ error: "User not found" });

  const targetRecord = await models.User.findByPk(targetId);
  if (!targetRecord) return res.status(404).json({ error: "User not found" });

  const viewer = viewerRecord.toJSON();
  const target = targetRecord.toJSON();

  if (String(target.id) !== String(req.user.id) && (!target.verified || !target.verified_photo || target.suspended)) {
    return res.status(404).json({ error: "User not found" });
  }

  const now = new Date();
  const age = computeAge(target.birthdate);
  const distance = buildDistance(viewer, target, 50);

  if (String(target.id) !== String(req.user.id)) {
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const existing = await models.ProfileView.findOne({
      where: {
        viewer_id: req.user.id,
        viewed_user_id: target.id,
        viewed_at: { [Op.gte]: since }
      }
    });

    if (!existing && !(viewer.premium && viewer.incognito_mode)) {
      await models.ProfileView.create({
        viewer_id: req.user.id,
        viewed_user_id: target.id,
        viewed_at: now
      });
      await models.User.increment("views_count", {
        by: 1,
        where: { id: target.id }
      });
    }
  }

  return res.json({
    id: target.id,
    _id: target.id,
    name: target.name,
    birthdate: target.birthdate,
    age,
    gender: target.gender,
    location: target.location,
    distance_km: distance,
    bio: target.bio,
    photos: target.photos || [],
    verified_photo: !!target.verified_photo,
    children_count: target.children_count ?? null,
    smoker: target.smoker ?? null,
    religion: target.religion ?? null,
    profession: target.profession || "",
    education_level: target.education_level || "",
    height_cm: target.height_cm ?? null,
    family_status: target.family_status || "",
    languages: target.languages || [],
    looking_for: target.looking_for || "",
    views_count: target.views_count || 0
  });
});

router.get("/views", auth, async (req, res) => {
  const viewsRows = await models.ProfileView.findAll({
    where: { viewed_user_id: req.user.id },
    order: [["viewed_at", "DESC"]],
    limit: 200
  });
  const views = toPlainList(viewsRows);

  const viewerIds = [...new Set(views.map((row) => String(row.viewer_id)))];
  const viewersRows = viewerIds.length === 0
    ? []
    : await models.User.findAll({
      where: { id: { [Op.in]: viewerIds } },
      attributes: ["id", "name", "location", "photos", "verified_photo"]
    });
  const viewerMap = new Map(toPlainList(viewersRows).map((user) => [String(user.id), user]));

  const payload = views
    .map((row) => {
      const viewer = viewerMap.get(String(row.viewer_id));
      if (!viewer) return null;
      return {
        id: viewer.id,
        _id: viewer.id,
        name: viewer.name,
        location: viewer.location,
        photos: viewer.photos || [],
        verified_photo: !!viewer.verified_photo,
        viewed_at: row.viewed_at
      };
    })
    .filter(Boolean);

  return res.json(payload);
});

router.get("/nearby", auth, async (req, res) => {
  const meRecord = await models.User.findByPk(req.user.id);
  if (!meRecord) return res.status(404).json({ error: "User not found" });
  const me = meRecord.toJSON();

  if (!Number.isFinite(me.location_lat) || !Number.isFinite(me.location_lng)) {
    return res.status(400).json({ error: "Location not set" });
  }
  const meCity = normalizeCity(me.location_city || me.location);
  if (!meCity) {
    return res.status(400).json({ error: "City not set" });
  }

  const [usersRows, likedRows, matchRowsRecords] = await Promise.all([
    models.User.findAll({
      where: {
        id: { [Op.ne]: req.user.id },
        verified: true,
        verified_photo: true,
        suspended: { [Op.ne]: true }
      }
    }),
    models.Like.findAll({
      where: { from_user_id: req.user.id },
      attributes: ["to_user_id"]
    }),
    models.Match.findAll({
      where: {
        [Op.or]: [{ user1_id: req.user.id }, { user2_id: req.user.id }]
      },
      attributes: ["user1_id", "user2_id"]
    })
  ]);

  const users = toPlainList(usersRows);
  const likedSet = new Set(likedRows.map((row) => String(row.to_user_id)));
  const matchRows = toPlainList(matchRowsRecords);
  const matchSet = new Set(
    matchRows.map((row) =>
      String(row.user1_id) === String(req.user.id) ? String(row.user2_id) : String(row.user1_id)
    )
  );

  const baseNearby = users
    .map((user) => {
      if (me.gender && user.gender && me.gender === user.gender) {
        return null;
      }
      if (matchSet.has(String(user.id))) return null;
      const userCity = normalizeCity(user.location_city || user.location);
      if (!userCity || userCity !== meCity) return null;
      if (!Number.isFinite(user.location_lat) || !Number.isFinite(user.location_lng)) return null;
      const distance = Math.round(haversineKm(
        me.location_lat,
        me.location_lng,
        user.location_lat,
        user.location_lng
      ));
      return {
        id: user.id,
        _id: user.id,
        name: user.name,
        age: computeAge(user.birthdate),
        gender: user.gender,
        location: user.location,
        distance_km: distance,
        interests: user.interests || [],
        bio: user.bio,
        photos: user.photos || [],
        verified_photo: !!user.verified_photo
      };
    })
    .filter(Boolean)
    .filter((user) => user.distance_km <= 15);

  let payload = baseNearby.filter((user) => !likedSet.has(String(user.id)));
  if (payload.length === 0) {
    payload = baseNearby;
  }

  return res.json(payload);
});

module.exports = router;
