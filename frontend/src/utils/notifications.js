import { sendNotificationEmail } from "../api/notifications.js";
import { currency, formatDate } from "./format.js";
import { t } from "./i18n.js";

const DEFAULT_NOTIFICATION_SETTINGS = {
  pushNotifications: true,
  emailNotifications: true,
  thresholdAlerts: true
};

const storageKey = (email) => `finance_notifications:${email || "guest"}`;
const settingsKey = (email) => `finance_local_settings:${email || "guest"}`;
const budgetsKey = (email) => `finance_local_budgets:${email || "guest"}`;

const safeParse = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export const getNotificationSettings = (email) => {
  if (typeof localStorage === "undefined") return DEFAULT_NOTIFICATION_SETTINGS;
  return {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...safeParse(localStorage.getItem(settingsKey(email)), DEFAULT_NOTIFICATION_SETTINGS)
  };
};

const generateId = () => `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const getNotifications = (email) => {
  if (typeof localStorage === "undefined") return [];
  const stored = safeParse(localStorage.getItem(storageKey(email)), []);
  return Array.isArray(stored) ? stored : [];
};

export const saveNotifications = (email, items) => {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(storageKey(email), JSON.stringify(items));
    } catch {
      // ignore
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("finance:notifications", {
        detail: { email: email || "guest", items }
      })
    );
  }
};

const normalizeNotification = (payload) => ({
  id: payload.id || generateId(),
  key: payload.key || generateId(),
  type: payload.type || "info",
  titleKey: payload.titleKey,
  bodyKey: payload.bodyKey,
  vars: payload.vars || {},
  createdAt: payload.createdAt || new Date().toISOString(),
  read: Boolean(payload.read),
  channel: payload.channel || "web"
});

const upsertByKey = (list, payload) => {
  const index = list.findIndex((item) => item.key && item.key === payload.key);
  if (index === -1) {
    const normalized = normalizeNotification(payload);
    return { list: [normalized, ...list], created: true, item: normalized };
  }
  const existing = list[index];
  const next = { ...existing, ...payload, id: existing.id, read: existing.read };
  const updatedList = [...list];
  updatedList[index] = next;
  return { list: updatedList, created: false, item: next };
};

const deliverBrowserNotification = (notification, settings) => {
  if (!settings.pushNotifications || typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const vars = formatNotificationVars(notification.vars);
  const title = t(notification.titleKey, vars, notification.titleKey);
  const body = t(notification.bodyKey, vars, notification.bodyKey);
  try {
    new Notification(title, { body });
  } catch {
    // ignore
  }
};

const deliverEmailNotification = async (notification, settings) => {
  if (!settings.emailNotifications) return;
  const vars = formatNotificationVars(notification.vars);
  const subject = t(notification.titleKey, vars, notification.titleKey);
  const message = t(notification.bodyKey, vars, notification.bodyKey);
  try {
    await sendNotificationEmail({ subject, message });
  } catch {
    // ignore email failures in UI
  }
};

export const pushNotification = async (email, payload, options = {}) => {
  const current = getNotifications(email);
  const { list, created, item } = upsertByKey(current, payload);
  const next = list.slice(0, 200).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  saveNotifications(email, next);
  const settings = options.settings || getNotificationSettings(email);
  if (created && options.deliver !== false) {
    deliverBrowserNotification(item, settings);
    await deliverEmailNotification(item, settings);
  }
  return { list: next, created, item };
};

export const mergeNotifications = async (email, payloads, options = {}) => {
  let current = getNotifications(email);
  const createdItems = [];
  payloads.forEach((payload) => {
    const result = upsertByKey(current, payload);
    current = result.list;
    if (result.created) createdItems.push(result.item);
  });
  const next = current.slice(0, 200).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  saveNotifications(email, next);
  const settings = options.settings || getNotificationSettings(email);
  if (options.deliver !== false) {
    for (const item of createdItems) {
      deliverBrowserNotification(item, settings);
      await deliverEmailNotification(item, settings);
    }
  }
  return { list: next, createdItems };
};

export const markNotificationRead = (email, id) => {
  const current = getNotifications(email);
  const next = current.map((item) => (item.id === id ? { ...item, read: true } : item));
  saveNotifications(email, next);
  return next;
};

export const markAllRead = (email) => {
  const current = getNotifications(email);
  const next = current.map((item) => ({ ...item, read: true }));
  saveNotifications(email, next);
  return next;
};

export const clearNotifications = (email) => {
  saveNotifications(email, []);
  return [];
};

const daysBetween = (from, to) => {
  const start = new Date(from);
  const end = new Date(to);
  const diff = Math.ceil((end - start) / 86400000);
  return diff + 1;
};

const estimatePeriodDays = (plan) => {
  if (plan.startDate && plan.endDate) {
    return Math.max(1, daysBetween(plan.startDate, plan.endDate));
  }
  if (plan.cycle === "weekly") return 7;
  if (plan.cycle === "yearly") return 365;
  return 30;
};

const computeSpent = (plan, transactions) => {
  return transactions
    .filter((item) => item.transaction_type === "expense")
    .filter((item) =>
      !plan.categoryIds.length ? true : plan.categoryIds.includes(String(item.category_id))
    )
    .filter((item) => (plan.startDate ? item.date >= plan.startDate : true))
    .filter((item) => (plan.endDate ? item.date <= plan.endDate : true))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
};

export const buildNotificationsFromData = ({ email, summary, breakdown, transactions }) => {
  const settings = getNotificationSettings(email);
  const items = [];
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const txList = Array.isArray(transactions) ? transactions : transactions?.items || [];

  if (summary && summary.total_expense > summary.total_income && settings.thresholdAlerts) {
    items.push({
      key: `alert:overspend:${monthKey}`,
      type: "warning",
      titleKey: "notif.over_spend_title",
      bodyKey: "notif.over_spend_body",
      vars: { expense: summary.total_expense, income: summary.total_income }
    });
  }

  const topCategory = breakdown?.[0];
  if (topCategory && topCategory.share >= 0.35) {
    items.push({
      key: `insight:top-category:${monthKey}`,
      type: "insight",
      titleKey: "notif.top_category_title",
      bodyKey: "notif.top_category_body",
      vars: {
        category: topCategory.category,
        percent: topCategory.share * 100
      }
    });
  }

  const recentExpenses = txList
    .filter((item) => item.transaction_type === "expense")
    .filter((item) => {
      const date = new Date(item.date);
      return now - date <= 7 * 86400000;
    });
  const largestExpense = recentExpenses.sort((a, b) => Number(b.amount) - Number(a.amount))[0];
  if (largestExpense && Number(largestExpense.amount || 0) > 0) {
    const totalExpense = summary?.total_expense || 0;
    const ratio = totalExpense ? Number(largestExpense.amount) / totalExpense : 0;
    if (ratio >= 0.25 && settings.thresholdAlerts) {
      items.push({
        key: `alert:large-tx:${largestExpense.id}`,
        type: "warning",
        titleKey: "notif.large_tx_title",
        bodyKey: "notif.large_tx_body",
        vars: {
          amount: Number(largestExpense.amount),
          date: largestExpense.date
        }
      });
    }
  }

  const budgetPlans = safeParse(
    typeof localStorage === "undefined" ? null : localStorage.getItem(budgetsKey(email)),
    []
  );
  budgetPlans.forEach((plan) => {
    const spent = computeSpent(plan, txList);
    const budget = Number(plan.amount) || 0;
    if (!budget) return;
    const progress = (spent / budget) * 100;
    const threshold = Number(plan.threshold) || 80;
    if (!settings.thresholdAlerts) return;
    const periodDays = estimatePeriodDays(plan);
    const elapsedDays = plan.startDate
      ? Math.max(1, Math.min(periodDays, daysBetween(plan.startDate, new Date().toISOString().slice(0, 10))))
      : Math.ceil(periodDays / 2);
    const forecast = elapsedDays > 0 ? (spent / elapsedDays) * periodDays : spent;
    const willOverrun = forecast > budget;
    if (progress < threshold && !willOverrun) return;
    items.push({
      key: `budget:threshold:${plan.id}`,
      type: progress >= 100 || willOverrun ? "warning" : "info",
      titleKey: "notif.budget_threshold_title",
      bodyKey: "notif.budget_threshold_body",
      vars: {
        name: plan.name,
        percent: progress,
        forecast
      }
    });
  });

  if (!items.length && txList.length) {
    items.push({
      key: `insight:stable:${monthKey}`,
      type: "insight",
      titleKey: "notif.ai_tip_title",
      bodyKey: "notif.ai_tip_body",
      vars: {}
    });
  }

  return items;
};

export const buildTransactionNotification = (transaction) => ({
  key: `tx:created:${transaction.id}`,
  type: "info",
  titleKey: "notif.tx_created_title",
  bodyKey: "notif.tx_created_body",
  vars: {
    amount: Number(transaction.amount || 0),
    date: transaction.date
  }
});

export const getNotificationCounts = (items) => {
  const total = items.length;
  const unread = items.filter((item) => !item.read).length;
  return { total, unread };
};

export const getNotificationTypeLabel = (type) => {
  if (type === "warning") return t("notif.type.warning", null, "Warning");
  if (type === "insight") return t("notif.type.insight", null, "Insight");
  return t("notif.type.info", null, "Update");
};

export const formatNotificationVars = (vars = {}) => {
  return {
    ...vars,
    amount: typeof vars.amount === "number" ? currency(vars.amount) : vars.amount,
    expense: typeof vars.expense === "number" ? currency(vars.expense) : vars.expense,
    income: typeof vars.income === "number" ? currency(vars.income) : vars.income,
    forecast: typeof vars.forecast === "number" ? currency(vars.forecast) : vars.forecast,
    budget: typeof vars.budget === "number" ? currency(vars.budget) : vars.budget,
    percent: typeof vars.percent === "number" ? `${Math.round(vars.percent)}%` : vars.percent,
    date: vars.date ? formatDate(vars.date) : vars.date
  };
};
