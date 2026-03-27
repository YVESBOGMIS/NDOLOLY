const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

export const resolvePhoto = (path) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${apiUrl}${path}`;
};
