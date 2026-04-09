const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

const STAFF_NAME_PATTERN = /\b(admin|backoffice)\b/i;
const STAFF_META_PATTERN = /\b(admin|backoffice|moderation|administration|staff|support)\b/i;

export const resolvePhoto = (path) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${apiUrl}${path}`;
};

export const isPrivateStaffProfile = (profile) => {
  if (!profile || typeof profile !== "object") return false;
  if (String(profile.role || "").toLowerCase() === "admin") return true;

  const name = String(profile.name || "");
  const location = String(profile.location || "");
  const gender = String(profile.gender || "");
  const profession = String(profile.profession || "");
  const education = String(profile.education_level || "");
  const bio = String(profile.bio || "");

  return STAFF_NAME_PATTERN.test(name)
    || STAFF_META_PATTERN.test(location)
    || STAFF_META_PATTERN.test(gender)
    || STAFF_META_PATTERN.test(profession)
    || STAFF_META_PATTERN.test(education)
    || STAFF_META_PATTERN.test(bio);
};

export const sanitizePublicProfile = (profile) => {
  if (!profile || typeof profile !== "object") return null;
  return isPrivateStaffProfile(profile) ? null : profile;
};

export const sanitizePublicProfiles = (profiles) => (
  Array.isArray(profiles)
    ? profiles.map((profile) => sanitizePublicProfile(profile)).filter(Boolean)
    : []
);

export const sanitizePublicMatches = (matches) => (
  Array.isArray(matches)
    ? matches.filter((item) => !isPrivateStaffProfile(item?.user))
    : []
);
