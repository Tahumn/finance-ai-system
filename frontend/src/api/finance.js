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

export const updateCategory = (categoryId, payload) =>
  request(`/finance/categories/${categoryId}`, {
    method: "PUT",
    body: payload
  });

export const deleteCategory = (categoryId) =>
  request(`/finance/categories/${categoryId}`, {
    method: "DELETE"
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

export const listAccounts = async () => {
  try {
    return await request("/finance/accounts");
  } catch (err) {
    if (err?.status === 404) return [];
    throw err;
  }
};

export const createAccount = (payload) =>
  request("/finance/accounts", {
    method: "POST",
    body: payload
  });

export const updateAccount = (accountId, payload) =>
  request(`/finance/accounts/${accountId}`, {
    method: "PUT",
    body: payload
  });

export const deleteAccount = (accountId) =>
  request(`/finance/accounts/${accountId}`, {
    method: "DELETE"
  });

export const getSummary = (params) =>
  request(`/finance/reports/summary${buildQuery(params)}`);

export const getCategoryBreakdown = (params) =>
  request(`/finance/reports/category-breakdown${buildQuery(params)}`);

export const getChartData = (params) =>
  request(`/finance/reports/chart${buildQuery(params)}`);

export const getReportsOverview = (params) =>
  request(`/finance/reports/overview${buildQuery(params)}`);

export const listSavingsGoals = () => request("/finance/savings-goals");

export const createSavingsGoal = (payload) =>
  request("/finance/savings-goals", {
    method: "POST",
    body: payload
  });

export const updateSavingsGoal = (goalId, payload) =>
  request(`/finance/savings-goals/${goalId}`, {
    method: "PUT",
    body: payload
  });

export const deleteSavingsGoal = (goalId) =>
  request(`/finance/savings-goals/${goalId}`, {
    method: "DELETE"
  });

export const listBudgets = async (params) => {
  try {
    return await request(`/finance/budgets${buildQuery(params)}`);
  } catch (err) {
    if (err?.status === 404) return [];
    throw err;
  }
};

export const createBudget = (payload) =>
  request("/finance/budgets", {
    method: "POST",
    body: payload
  });

export const updateBudget = (budgetId, payload) =>
  request(`/finance/budgets/${budgetId}`, {
    method: "PUT",
    body: payload
  });

export const deleteBudget = (budgetId) =>
  request(`/finance/budgets/${budgetId}`, {
    method: "DELETE"
  });

export const bootstrapFinance = async () => {
  try {
    return await request("/finance/bootstrap", {
      method: "POST"
    });
  } catch (err) {
    if (err?.status === 404) return { created_categories: 0, created_tags: 0, created_budgets: 0 };
    throw err;
  }
};

export const listBills = async () => {
  try {
    return await request("/finance/bills");
  } catch (err) {
    if (err?.status === 404) return [];
    throw err;
  }
};

export const createBill = (payload) =>
  request("/finance/bills", {
    method: "POST",
    body: payload
  });

export const updateBill = (billId, payload) =>
  request(`/finance/bills/${billId}`, {
    method: "PUT",
    body: payload
  });

export const deleteBill = (billId) =>
  request(`/finance/bills/${billId}`, {
    method: "DELETE"
  });

export const listAccountHistory = () => request("/finance/accounts/history");
