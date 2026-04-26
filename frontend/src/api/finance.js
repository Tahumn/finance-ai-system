import { request } from "./client.js";

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, value);
  });
  const qs = query.toString();
  return qs ? `?${qs}` : "";
};

export const listCategories = () => request("/finance/categories");

export const createCategory = (name) =>
  request("/finance/categories", {
    method: "POST",
    body: { name }
  });

export const listTags = async () => {
  try {
    return await request("/finance/tags");
  } catch (err) {
    if (err.status === 404) return [];
    throw err;
  }
};

export const createTag = (payload) =>
  request("/finance/tags", {
    method: "POST",
    body: payload
  });

export const updateTag = (tagId, payload) =>
  request(`/finance/tags/${tagId}`, {
    method: "PUT",
    body: payload
  });

export const deleteTag = (tagId) =>
  request(`/finance/tags/${tagId}`, {
    method: "DELETE"
  });

export const listTransactions = (params) =>
  request(`/finance/transactions${buildQuery(params)}`);

export const createTransaction = (payload) =>
  request("/finance/transactions", {
    method: "POST",
    body: payload
  });

export const updateTransaction = (transactionId, payload) =>
  request(`/finance/transactions/${transactionId}`, {
    method: "PUT",
    body: payload
  });

export const deleteTransaction = (transactionId) =>
  request(`/finance/transactions/${transactionId}`, {
    method: "DELETE"
  });

export const getSummary = (params) =>
  request(`/finance/reports/summary${buildQuery(params)}`);

export const getCategoryBreakdown = (params) =>
  request(`/finance/reports/category-breakdown${buildQuery(params)}`);

export const getChartData = (params) =>
  request(`/finance/reports/chart${buildQuery(params)}`);

export const getAnomalies = () =>
  request("/finance/reports/anomalies");
