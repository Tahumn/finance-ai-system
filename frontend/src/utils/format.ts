export const formatCurrency = (value: number) => {
  const rounded = Math.round(value || 0);
  return `${rounded.toLocaleString('en-US')} VND`;
};

export const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('en-GB');
};

export const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};
