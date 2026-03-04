import { request } from "./client.js";

export const parseTransaction = (text, options = {}) =>
  request("/ai/parse-transaction", {
    method: "POST",
    body: {
      text,
      default_date: options.default_date,
      auto_create_category: options.auto_create_category ?? true
    }
  });

export const createTransactionFromText = (text, options = {}) =>
  request("/ai/transactions", {
    method: "POST",
    body: {
      text,
      default_date: options.default_date,
      auto_create_category: options.auto_create_category ?? true
    }
  });

export const chatWithAi = (text) =>
  request("/ai/chat", {
    method: "POST",
    body: { text }
  });
