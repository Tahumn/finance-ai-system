import { request, requestForm } from "./client.js";

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

export const getChatHistory = (limit = 50) =>
  request(`/ai/chat/history?limit=${limit}`);

export const extractOcr = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return requestForm("/ocr/scan", formData);
};

export const getAnomalies = () => request("/ai/anomalies");

export const getForecast = () => request("/ai/forecast");

export const getSavingsTips = () => request("/ai/savings-tips");
