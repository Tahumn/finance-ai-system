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

// Subscriptions
export const listSubscriptions = () => request("/recurring/subscriptions");

export const createSubscription = (payload) =>
  request("/recurring/subscriptions", {
    method: "POST",
    body: payload
  });

export const updateSubscription = (id, payload) =>
  request(`/recurring/subscriptions/${id}`, {
    method: "PUT",
    body: payload
  });

export const deleteSubscription = (id) =>
  request(`/recurring/subscriptions/${id}`, {
    method: "DELETE"
  });

export const paySubscription = (id) =>
  request(`/recurring/subscriptions/${id}/pay`, {
    method: "POST"
  });

// Debts
export const listDebts = () => request("/recurring/debts");

export const createDebt = (payload) =>
  request("/recurring/debts", {
    method: "POST",
    body: payload
  });

export const updateDebt = (id, payload) =>
  request(`/recurring/debts/${id}`, {
    method: "PUT",
    body: payload
  });

export const deleteDebt = (id) =>
  request(`/recurring/debts/${id}`, {
    method: "DELETE"
  });

export const payDebt = (id) =>
  request(`/recurring/debts/${id}/pay`, {
    method: "POST"
  });

// Reminders
export const listReminders = () => request("/recurring/reminders");

export const createReminder = (payload) =>
  request("/recurring/reminders", {
    method: "POST",
    body: payload
  });
