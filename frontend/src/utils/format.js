export const currency = (value) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    value || 0
  );

export const formatDate = (value) =>
  new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

export const percent = (value) => `${Math.round(value * 100)}%`;

export const toInputDate = (date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};
