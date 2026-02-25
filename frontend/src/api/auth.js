import { request } from "./client.js";

export const login = (email, password) =>
  request("/auth/login", {
    method: "POST",
    body: { email, password }
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
