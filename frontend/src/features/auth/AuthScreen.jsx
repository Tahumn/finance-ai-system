import { useEffect, useRef, useState } from "react";
import { t } from "../../utils/i18n.js";

const buildPasswordRules = () => [
  { label: t("auth.password_rules_1"), test: (value) => value.length >= 8 },
  { label: t("auth.password_rules_2"), test: (value) => /[A-Za-z]/.test(value) },
  { label: t("auth.password_rules_3"), test: (value) => /[\d\W]/.test(value) }
];

const strengthLabel = (score) => {
  if (score <= 1) return t("auth.password_strength_weak");
  if (score === 2) return t("auth.password_strength_mid");
  return t("auth.password_strength_strong");
};

function EyeIcon({ open }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      {!open && (
        <path
          d="M4 4l16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function PasswordField({ value, onChange, placeholder, show, onToggle, name }) {
  return (
    <div className="input-with-icon">
      <input
        name={name}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
      <button
        className="icon-btn"
        type="button"
        onClick={onToggle}
        aria-label={show ? t("auth.hide_password") : t("auth.show_password")}
      >
        <EyeIcon open={show} />
      </button>
    </div>
  );
}

export default function AuthScreen({
  mode,
  setMode,
  onSubmit,
  onVerifyOtp,
  onResendOtp,
  onSetPassword,
  onResetStart,
  onResetVerify,
  onResetConfirm,
  loading,
  error,
  notice
}) {
  const [step, setStep] = useState(mode === "login" ? "login" : "register");
  const [pendingEmail, setPendingEmail] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [registrationToken, setRegistrationToken] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const otpRefs = useRef([]);

  useEffect(() => {
    setStep(mode === "login" ? "login" : "register");
    setPendingEmail("");
    setResetEmail("");
    setOtpDigits(["", "", "", "", "", ""]);
    setRegistrationToken("");
    setResetToken("");
    setNewPassword("");
    setConfirmPassword("");
    setLoginPassword("");
    setShowLoginPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  }, [mode]);

  const otpCode = otpDigits.join("");
  const otpValid = otpCode.length === 6 && /^\d{6}$/.test(otpCode);

  const passwordRules = buildPasswordRules();
  const passwordScore = passwordRules.reduce(
    (acc, rule) => acc + (rule.test(newPassword) ? 1 : 0),
    0
  );

  const passwordOk = passwordScore >= 3;
  const confirmOk = newPassword && newPassword === confirmPassword;

  const handleOtpChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otpDigits];
    next[index] = value;
    setOtpDigits(next);
    if (value && otpRefs.current[index + 1]) {
      otpRefs.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (index, event) => {
    if (event.key === "Backspace" && !otpDigits[index] && otpRefs.current[index - 1]) {
      otpRefs.current[index - 1].focus();
    }
  };

  const handleRegisterSubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const full_name = String(form.get("full_name") || "");
    const username = String(form.get("username") || "");
    const email = String(form.get("email") || "");
    const phone = String(form.get("phone") || "");
    const result = await onSubmit({
      full_name,
      username,
      email,
      phone: phone || null,
      mode: "register"
    });
    if (result?.next === "otp") {
      setPendingEmail(email);
      setStep("otp");
      setOtpDigits(["", "", "", "", "", ""]);
      setTimeout(() => otpRefs.current[0]?.focus(), 0);
    }
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const identifier = String(form.get("identifier") || "");
    await onSubmit({ identifier, password: loginPassword, remember, mode: "login" });
  };

  const handleResetRequest = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const ok = await onResetStart(email);
    if (ok) {
      setResetEmail(email);
      setStep("reset_otp");
      setOtpDigits(["", "", "", "", "", ""]);
      setTimeout(() => otpRefs.current[0]?.focus(), 0);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>{t("auth.title")}</h1>
        <p className="subhead">{t("auth.subtitle")}</p>
        <div className="auth-tabs">
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
            type="button"
          >
            {t("auth.login")}
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
            type="button"
          >
            {t("auth.register")}
          </button>
        </div>

        {step === "register" && (
          <form className="form" onSubmit={handleRegisterSubmit}>
            <input
              name="full_name"
              type="text"
              placeholder={t("auth.full_name")}
              maxLength={100}
              required
            />
            <input
              name="username"
              type="text"
              placeholder={t("auth.username")}
              maxLength={100}
              required
            />
            <input name="email" type="email" placeholder={t("auth.email")} required />
            <input name="phone" type="tel" placeholder={t("auth.phone")} />
            <button className="primary" type="submit" disabled={loading}>
              {t("auth.register_otp")}
            </button>
            <button className="ghost" type="button" onClick={() => setMode("login")}>
              {t("auth.login_exists")}
            </button>
            {error && <p className="form-error">{error}</p>}
            {notice && !error && <p className="form-note">{notice}</p>}
          </form>
        )}

        {step === "otp" && (
          <div className="form">
            <p className="otp-hint">
              {t("auth.otp_sent")} <strong>{pendingEmail}</strong>
            </p>
            <div className="otp-inputs">
              {otpDigits.map((digit, index) => (
                <input
                  key={`otp-${index}`}
                  ref={(el) => (otpRefs.current[index] = el)}
                  value={digit}
                  inputMode="numeric"
                  maxLength={1}
                  onChange={(event) => handleOtpChange(index, event.target.value)}
                  onKeyDown={(event) => handleOtpKeyDown(index, event)}
                />
              ))}
            </div>
            <button
              className="primary"
              type="button"
              disabled={loading || !otpValid}
              onClick={async () => {
                const result = await onVerifyOtp(pendingEmail, otpCode);
                if (result?.registration_token) {
                  setRegistrationToken(result.registration_token);
                  setStep("set_password");
                }
              }}
            >
              {t("auth.verify_otp")}
            </button>
            <button
              className="ghost"
              type="button"
              disabled={loading}
              onClick={() => onResendOtp(pendingEmail)}
            >
              {t("auth.resend")}
            </button>
            <button className="ghost" type="button" onClick={() => setStep("register")}>
              {t("auth.change_email", null, "Đổi email")}
            </button>
            {error && <p className="form-error">{error}</p>}
            {notice && !error && <p className="form-note">{notice}</p>}
          </div>
        )}

        {step === "set_password" && (
          <div className="form">
            <p className="otp-hint">
              {t("auth.verified_hint", null, "Email đã xác thực. Tạo mật khẩu để kích hoạt tài khoản.")}
            </p>
            <PasswordField
              name="new_password"
              placeholder={t("auth.new_password")}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              show={showNewPassword}
              onToggle={() => setShowNewPassword((prev) => !prev)}
            />
            <div className="meter">
              <div
                className="meter-fill"
                style={{ width: `${(passwordScore / 3) * 100}%` }}
              />
            </div>
            <p className="meter-label">
              {t("auth.password_strength")}: {strengthLabel(passwordScore)}
            </p>
            <PasswordField
              name="confirm_password"
              placeholder={t("auth.confirm_password")}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              show={showConfirmPassword}
              onToggle={() => setShowConfirmPassword((prev) => !prev)}
            />
            {!confirmOk && confirmPassword && (
              <p className="form-error">
                {t("auth.confirm_mismatch", null, "Mật khẩu xác nhận không khớp.")}
              </p>
            )}
            <button
              className="primary"
              type="button"
              disabled={loading || !passwordOk || !confirmOk}
              onClick={async () => {
                const ok = await onSetPassword(registrationToken, newPassword);
                if (ok) {
                  const result = await onSubmit({
                    identifier: pendingEmail,
                    password: newPassword,
                    remember,
                    mode: "login"
                  });
                  if (result?.next !== "authed") {
                    setMode("login");
                    setStep("login");
                  }
                }
              }}
            >
              {t("auth.save_password")}
            </button>
            <button className="ghost" type="button" onClick={() => setStep("otp")}>
              {t("auth.back_otp", null, "Quay lại OTP")}
            </button>
            {error && <p className="form-error">{error}</p>}
            {notice && !error && <p className="form-note">{notice}</p>}
          </div>
        )}

        {step === "login" && (
          <form className="form" onSubmit={handleLoginSubmit}>
            <input name="identifier" type="text" placeholder={t("auth.identifier")} required />
            <PasswordField
              name="password"
              placeholder={t("auth.password")}
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              show={showLoginPassword}
              onToggle={() => setShowLoginPassword((prev) => !prev)}
            />
            <label className="checkbox">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              {t("auth.remember")}
            </label>
            <button className="primary" type="submit" disabled={loading}>
              {t("auth.login_label")}
            </button>
            <button className="ghost" type="button" onClick={() => setMode("register")}>
              {t("auth.register")}
            </button>
            <button className="ghost" type="button" onClick={() => setStep("reset_request")}>
              {t("auth.forgot")}
            </button>
            {error && <p className="form-error">{error}</p>}
            {notice && !error && <p className="form-note">{notice}</p>}
          </form>
        )}

        {step === "reset_request" && (
          <form className="form" onSubmit={handleResetRequest}>
            <input name="email" type="email" placeholder={t("auth.reset_email")} required />
            <button className="primary" type="submit" disabled={loading}>
              {t("auth.reset_send")}
            </button>
            <button className="ghost" type="button" onClick={() => setStep("login")}>
              {t("common.back")}
            </button>
            {error && <p className="form-error">{error}</p>}
            {notice && !error && <p className="form-note">{notice}</p>}
          </form>
        )}

        {step === "reset_otp" && (
          <div className="form">
            <p className="otp-hint">
              {t("auth.otp_sent")} <strong>{resetEmail}</strong>
            </p>
            <div className="otp-inputs">
              {otpDigits.map((digit, index) => (
                <input
                  key={`reset-otp-${index}`}
                  ref={(el) => (otpRefs.current[index] = el)}
                  value={digit}
                  inputMode="numeric"
                  maxLength={1}
                  onChange={(event) => handleOtpChange(index, event.target.value)}
                  onKeyDown={(event) => handleOtpKeyDown(index, event)}
                />
              ))}
            </div>
            <button
              className="primary"
              type="button"
              disabled={loading || !otpValid}
              onClick={async () => {
                const result = await onResetVerify(resetEmail, otpCode);
                if (result?.reset_token) {
                  setResetToken(result.reset_token);
                  setStep("reset_set_password");
                }
              }}
            >
              {t("auth.reset_verify")}
            </button>
            <button
              className="ghost"
              type="button"
              disabled={loading}
              onClick={() => onResetStart(resetEmail)}
            >
              {t("auth.resend")}
            </button>
            <button className="ghost" type="button" onClick={() => setStep("reset_request")}>
              {t("auth.change_email", null, "Đổi email")}
            </button>
            {error && <p className="form-error">{error}</p>}
            {notice && !error && <p className="form-note">{notice}</p>}
          </div>
        )}

        {step === "reset_set_password" && (
          <div className="form">
            <p className="otp-hint">
              {t("auth.reset_hint", null, "Tạo mật khẩu mới để đăng nhập.")}
            </p>
            <PasswordField
              name="reset_password"
              placeholder={t("auth.new_password")}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              show={showNewPassword}
              onToggle={() => setShowNewPassword((prev) => !prev)}
            />
            <div className="meter">
              <div
                className="meter-fill"
                style={{ width: `${(passwordScore / 3) * 100}%` }}
              />
            </div>
            <p className="meter-label">
              {t("auth.password_strength")}: {strengthLabel(passwordScore)}
            </p>
            <PasswordField
              name="reset_confirm"
              placeholder={t("auth.confirm_password")}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              show={showConfirmPassword}
              onToggle={() => setShowConfirmPassword((prev) => !prev)}
            />
            {!confirmOk && confirmPassword && (
              <p className="form-error">
                {t("auth.confirm_mismatch", null, "Mật khẩu xác nhận không khớp.")}
              </p>
            )}
            <button
              className="primary"
              type="button"
              disabled={loading || !passwordOk || !confirmOk}
              onClick={async () => {
                const ok = await onResetConfirm(resetToken, newPassword);
                if (ok) {
                  setMode("login");
                  setStep("login");
                }
              }}
            >
              {t("auth.save_password")}
            </button>
            <button className="ghost" type="button" onClick={() => setStep("reset_otp")}>
              {t("auth.back_otp", null, "Quay lại OTP")}
            </button>
            {error && <p className="form-error">{error}</p>}
            {notice && !error && <p className="form-note">{notice}</p>}
          </div>
        )}
      </section>
    </main>
  );
}
