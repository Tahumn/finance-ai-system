import { request } from "./client.js";

export const sendNotificationEmail = ({ subject, message }) =>
  request("/notifications/email", {
    method: "POST",
    body: { subject, message }
  });
