import { request } from "./client.js";

export const listBudgets = () => request("/planning/budgets");
export const createBudget = (data) => request("/planning/budgets", { method: "POST", body: data });
export const updateBudget = (id, data) => request(`/planning/budgets/${id}`, { method: "PUT", body: data });
export const deleteBudget = (id) => request(`/planning/budgets/${id}`, { method: "DELETE" });

export const listGoals = () => request("/planning/goals");
export const createGoal = (data) => request("/planning/goals", { method: "POST", body: data });
export const updateGoal = (id, data) => request(`/planning/goals/${id}`, { method: "PUT", body: data });
export const deleteGoal = (id) => request(`/planning/goals/${id}`, { method: "DELETE" });
