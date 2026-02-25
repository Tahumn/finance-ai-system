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
