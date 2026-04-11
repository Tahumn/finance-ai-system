import { getCategoryPrefs } from "./userPrefs.js";

const palette = [
  "#ff8b5f",
  "#38b6ff",
  "#ffd166",
  "#06d6a0",
  "#8e7dff",
  "#f4a261",
  "#e76f51",
  "#2a9d8f",
  "#c084fc",
  "#3b82f6"
];

export const colorFor = (label, email) => {
  if (!label) return palette[0];
  const prefs = getCategoryPrefs(email);
  const stored = prefs[label];
  if (stored?.color) return stored.color;
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % palette.length;
  return palette[index];
};
