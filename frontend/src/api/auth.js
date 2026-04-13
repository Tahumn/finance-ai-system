import { request } from "./client.js";

export const login = (identifier, password) =>
  request("/auth/login", {
    method: "POST",
    body: { identifier, password }
  });

export const me = () => request("/auth/me");

export const registerWithProfile = (payload) =>
  request("/auth/register/start", {
    method: "POST",
    body: payload
  });

export const verifyOtp = (email, code) =>
  request("/auth/verify-otp", {
    method: "POST",
    body: { email, code }
  });

export const resendOtp = (email) =>
  request("/auth/resend-otp", {
    method: "POST",
    body: { email }
  });

export const setPassword = (registration_token, password) =>
  request("/auth/set-password", {
    method: "POST",
    body: { registration_token, password }
  });

export const resetPasswordStart = (email) =>
  request("/auth/password/reset/start", {
    method: "POST",
    body: { email }
  });

export const resetPasswordVerify = (email, code) =>
  request("/auth/password/reset/verify", {
    method: "POST",
    body: { email, code }
  });

export const resetPasswordConfirm = (reset_token, password) =>
  request("/auth/password/reset/confirm", {
    method: "POST",
    body: { reset_token, password }
  });
