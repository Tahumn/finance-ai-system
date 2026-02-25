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

export const colorFor = (label) => {
  if (!label) return palette[0];
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % palette.length;
  return palette[index];
};
