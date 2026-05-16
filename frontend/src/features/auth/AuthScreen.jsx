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

function Logo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#F9206B" />
      <path d="M2 17L12 22L22 17" stroke="#F9206B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 12L12 17L22 12" stroke="#F9206B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon({ open }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
      {!open && (
        <path
          d="M4 4l16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function SecurityIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 11 12 14 15 10" />
    </svg>
  );
}

function PasswordField({ label, name, placeholder, value, onChange, show, onToggle, required = true }) {
  return (
    <div className="auth-field-group">
      <label>{label}</label>
      <div className="auth-input-wrapper with-both-icons">
        <span className="auth-input-icon left">
          <LockIcon />
        </span>
        <input
          name={name}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
        />
        <button
          className="auth-input-icon right toggle-btn"
          type="button"
          onClick={onToggle}
          aria-label={show ? t("auth.hide_password") : t("auth.show_password")}
        >
          <EyeIcon open={show} />
        </button>
      </div>
    </div>
  );
}

export default function AuthScreen({
  mode = "login",
  setMode,
  onSubmit,
  onVerifyOtp,
  onResendOtp,
  onSetPassword,
  onResetPasswordStart,
  onResetPasswordVerify,
  onResetPasswordConfirm,
  onGoOnboarding,
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
  const [timer, setTimer] = useState(0);
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

  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  useEffect(() => {
    if (step === "otp" || step === "reset_otp") {
      setTimer(300); // 5 minutes
      setOtpDigits(["", "", "", "", "", ""]);
      setTimeout(() => otpRefs.current[0]?.focus(), 0);
    }
  }, [step]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

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
    // Handle pasting
    if (value.length > 1) {
      const pasted = value.slice(0, 6).split("");
      const next = [...otpDigits];
      pasted.forEach((char, i) => {
        if (index + i < 6 && /^\d$/.test(char)) {
          next[index + i] = char;
        }
      });
      setOtpDigits(next);
      const nextIndex = Math.min(index + pasted.length, 5);
      otpRefs.current[nextIndex]?.focus();
      return;
    }

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
    }
  };

  const heroTitle =
    mode === "login" ? (
      <>
        {t("auth.hero_welcome", null, "Chào mừng bạn")}
        <br />
        {t("auth.hero_back", null, "trở lại")}{" "}
        <span className="auth-brand">{t("app.brand", null, "Finanzy")}</span>
      </>
    ) : (
      <>
        {t("auth.hero_start", null, "Bắt đầu cùng")}
        <br />
        <span className="auth-brand">{t("app.brand", null, "Finanzy")}</span>
      </>
    );

  const heroDesc =
    mode === "login"
      ? t(
          "auth.hero_login_desc",
          null,
          "Đăng nhập để tiếp tục quản lý tài chính cá nhân thông minh và hiệu quả."
        )
      : t(
          "auth.hero_register_desc",
          null,
          "Tạo tài khoản để quản lý chi tiêu, tiết kiệm và đầu tư thông minh hơn mỗi ngày."
        );

  return (
    <main className="auth-shell">
      <div className="auth-layout">
        {/* Hero Section - Visible only on Web */}
        <section className="auth-hero">
          <header className="auth-hero-header">
            <div className="auth-logo">
              <Logo size={38} />
              <span className="logo-text">{t("app.brand", null, "Finanzy")}</span>
            </div>
          </header>
          <div className="auth-hero-inner">
            <h1 className="auth-hero-title">{heroTitle}</h1>
            <p className="auth-hero-desc">{heroDesc}</p>
          </div>
        </section>

        {/* Form Panel Section */}
        <section className="auth-panel">
          {/* Logo Mark for Mobile Header */}
          <div className="auth-mobile-header">
            <div className="auth-logo">
              <Logo size={42} />
              <span className="logo-text">{t("app.brand", null, "Finanzy")}</span>
            </div>
          </div>

          <div className="auth-card">
            <div className="auth-card-badge">
              <Logo size={36} />
            </div>

            <h2 className="auth-card-title">
              {step === "login" && t("auth.login", null, "Đăng nhập")}
              {step === "register" && t("auth.register", null, "Tạo tài khoản mới")}
              {step === "otp" && t("auth.verify_otp", null, "Xác thực OTP")}
              {step === "set_password" && t("auth.set_password", null, "Thiết lập mật khẩu")}
              {step === "reset_request" && t("auth.forgot", null, "Quên mật khẩu?")}
              {step === "reset_otp" && t("auth.verify_otp", null, "Xác thực OTP")}
              {step === "reset_set_password" && t("auth.reset_password", null, "Đặt lại mật khẩu")}
            </h2>
            
            <p className="auth-card-subtitle">
              {step === "login" && t("auth.login_subtitle", null, "Quản lý tài chính cá nhân thông minh")}
              {step === "register" && t("auth.register_subtitle", null, "Bắt đầu hành trình quản lý tài chính thông minh")}
              {(step === "otp" || step === "reset_otp") && t("auth.otp_sent_to", null, "Mã xác thực đã được gửi đến email của bạn")}
              {step === "set_password" && t("auth.verified_hint", null, "Email đã xác thực. Tạo mật khẩu để kích hoạt tài khoản.")}
              {step === "reset_request" && t("auth.reset_subtitle", null, "Nhập email để nhận mã khôi phục mật khẩu")}
            </p>

            <div className="auth-content">
              {step === "register" && (
                <form className="auth-form" onSubmit={handleRegisterSubmit}>
                  <div className="auth-field-group">
                    <label>{t("auth.full_name", null, "Họ và tên")}</label>
                    <div className="auth-input-wrapper with-icon">
                      <span className="auth-input-icon left"><UserIcon /></span>
                      <input name="full_name" type="text" placeholder={t("auth.full_name_placeholder", null, "Nhập họ và tên của bạn")} maxLength={100} required />
                    </div>
                  </div>
                  
                  <div className="auth-field-group">
                    <label>{t("auth.username", null, "Username")}</label>
                    <div className="auth-input-wrapper with-icon">
                      <span className="auth-input-icon left"><UserIcon /></span>
                      <input name="username" type="text" placeholder={t("auth.username_placeholder", null, "Nhập username của bạn")} maxLength={100} required />
                    </div>
                  </div>

                  <div className="auth-field-group">
                    <label>{t("auth.email", null, "Email")}</label>
                    <div className="auth-input-wrapper with-icon">
                      <span className="auth-input-icon left"><MailIcon /></span>
                      <input name="email" type="email" placeholder={t("auth.email_placeholder", null, "Nhập email của bạn")} required />
                    </div>
                  </div>

                  <div className="auth-field-group">
                    <label>{t("auth.phone", null, "Số điện thoại (optional)")}</label>
                    <div className="auth-input-wrapper with-icon">
                      <span className="auth-input-icon left"><PhoneIcon /></span>
                      <input name="phone" type="tel" placeholder={t("auth.phone_placeholder", null, "Nhập số điện thoại của bạn")} />
                    </div>
                  </div>

                  <div className="auth-info-row">
                    <SecurityIcon />
                    <span>{t("auth.otp_notice", null, "OTP sẽ được gửi để xác thực tài khoản")}</span>
                  </div>

                  <label className="auth-checkbox">
                    <input type="checkbox" required defaultChecked />
                    <span>
                      {t("auth.agree_prefix", null, "Tôi đồng ý với ")}
                      <a href="#terms" onClick={e => e.preventDefault()}>{t("auth.terms", null, "Điều khoản")}</a>
                      {t("auth.agree_and", null, " và ")}
                      <a href="#policy" onClick={e => e.preventDefault()}>{t("auth.policy", null, "Chính sách")}</a>
                    </span>
                  </label>

                  <button className="auth-btn-primary" type="submit" disabled={loading}>
                    <span>{t("auth.register_otp", null, "Đăng ký (Gửi OTP)")}</span>
                    <ArrowRightIcon />
                  </button>

                  <div className="auth-card-footer">
                    <span>{t("auth.login_exists", null, "Đã có tài khoản?")} </span>
                    <button type="button" className="auth-link-btn" onClick={() => setMode("login")}>
                      {t("auth.login", null, "Đăng nhập")}
                    </button>
                  </div>
                  
                  {error && <p className="auth-form-error">{error}</p>}
                </form>
              )}

              {step === "login" && (
                <form className="auth-form" onSubmit={handleLoginSubmit}>
                  <div className="auth-field-group">
                    <label>{t("auth.identifier", null, "Email hoặc Username")}</label>
                    <div className="auth-input-wrapper with-icon">
                      <span className="auth-input-icon left"><UserIcon /></span>
                      <input name="identifier" type="text" placeholder={t("auth.identifier_placeholder", null, "Nhập email hoặc username")} required />
                    </div>
                  </div>

                  <PasswordField
                    label={t("auth.password", null, "Mật khẩu")}
                    name="password"
                    placeholder={t("auth.password_placeholder", null, "Nhập mật khẩu")}
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    show={showLoginPassword}
                    onToggle={() => setShowLoginPassword((prev) => !prev)}
                  />

                  <div className="auth-form-row">
                    <label className="auth-checkbox">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(event) => setRemember(event.target.checked)}
                      />
                      <span>{t("auth.remember", null, "Ghi nhớ đăng nhập")}</span>
                    </label>
                    <button type="button" className="auth-forgot-link" onClick={() => setStep("reset_request")}>
                      {t("auth.forgot", null, "Quên mật khẩu?")}
                    </button>
                  </div>

                  <button className="auth-btn-primary" type="submit" disabled={loading}>
                    <span>{t("auth.login_label", null, "Đăng nhập")}</span>
                    <ArrowRightIcon />
                  </button>

                  <div className="auth-divider">
                    <span className="auth-security-info">
                      <SecurityIcon />
                      {t("auth.security_label", null, "Bảo mật SSL 256-bit • An toàn tuyệt đối")}
                    </span>
                  </div>

                  <div className="auth-card-footer">
                    <span>{t("auth.no_account", null, "Chưa có tài khoản?")} </span>
                    <button type="button" className="auth-link-btn" onClick={() => setMode("register")}>
                      {t("auth.register_now", null, "Đăng ký ngay")}
                    </button>
                    <ArrowRightIcon />
                  </div>

                  {error && <p className="auth-form-error">{error}</p>}
                </form>
              )}

              {/* OTP Step */}
              {(step === "otp" || step === "reset_otp") && (
                <div className="auth-form">
                  <p className="auth-otp-hint">
                    {t("auth.otp_sent")} <strong>{step === "otp" ? pendingEmail : resetEmail}</strong>
                  </p>
                  <div className="auth-otp-inputs">
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
                    className="auth-btn-primary"
                    type="button"
                    disabled={loading || !otpValid}
                    onClick={async () => {
                      if (step === "otp") {
                        const result = await onVerifyOtp(pendingEmail, otpCode);
                        if (result?.registration_token) {
                          setRegistrationToken(result.registration_token);
                          setStep("set_password");
                        }
                      } else {
                        const result = await onResetPasswordVerify(resetEmail, otpCode);
                        if (result?.reset_token) {
                          setResetToken(result.reset_token);
                          setStep("reset_set_password");
                        }
                      }
                    }}
                  >
                    <span>{t("auth.verify_otp", null, "Xác thực mã OTP")}</span>
                    <ArrowRightIcon />
                  </button>
                  
                  <div className="auth-otp-footer">
                    {timer > 0 ? (
                      <p className="auth-timer-text">
                        {t("auth.resend_in", null, "Gửi lại mã sau")} <strong>{formatTime(timer)}</strong>
                      </p>
                    ) : (
                      <button 
                        className="auth-resend-btn" 
                        type="button" 
                        disabled={loading} 
                        onClick={() => {
                          if (step === "otp") onResendOtp(pendingEmail);
                          else onResetPasswordStart(resetEmail);
                          setTimer(300);
                        }}
                      >
                        {t("auth.resend", null, "Gửi lại mã OTP")}
                      </button>
                    )}
                    <button className="auth-link-btn secondary" type="button" onClick={() => setStep(step === "otp" ? "register" : "reset_request")}>
                      {t("auth.change_email", null, "Đổi địa chỉ email")}
                    </button>
                  </div>
                  {error && <p className="auth-form-error">{error}</p>}
                </div>
              )}

              {/* Set Password Step */}
              {(step === "set_password" || step === "reset_set_password") && (
                <div className="auth-form">
                  <PasswordField
                    label={t("auth.new_password", null, "Mật khẩu mới")}
                    name="new_password"
                    placeholder={t("auth.new_password_placeholder", null, "Nhập mật khẩu mới")}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    show={showNewPassword}
                    onToggle={() => setShowNewPassword((prev) => !prev)}
                  />
                  
                  <div className="auth-password-strength">
                    <div className="strength-meter">
                      <div className="strength-fill" style={{ width: `${(passwordScore / 3) * 100}%`, backgroundColor: passwordScore >= 3 ? "#10b981" : passwordScore >= 2 ? "#f59e0b" : "#ef4444" }} />
                    </div>
                    <span className="strength-label">
                      {t("auth.password_strength")}: <strong>{strengthLabel(passwordScore)}</strong>
                    </span>
                  </div>

                  <PasswordField
                    label={t("auth.confirm_password", null, "Xác nhận mật khẩu")}
                    name="confirm_password"
                    placeholder={t("auth.confirm_password_placeholder", null, "Nhập lại mật khẩu")}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    show={showConfirmPassword}
                    onToggle={() => setShowConfirmPassword((prev) => !prev)}
                  />

                  {!confirmOk && confirmPassword && (
                    <p className="auth-form-error">{t("auth.confirm_mismatch", null, "Mật khẩu xác nhận không khớp.")}</p>
                  )}

                  <button
                    className="auth-btn-primary"
                    type="button"
                    disabled={loading || !passwordOk || !confirmOk}
                    onClick={async () => {
                      if (step === "set_password") {
                        const ok = await onSetPassword(registrationToken, newPassword);
                        if (ok) {
                          await onSubmit({ identifier: pendingEmail, password: newPassword, remember, mode: "login" });
                        }
                      } else {
                        const ok = await onResetPasswordConfirm(resetToken, newPassword);
                        if (ok) {
                          setMode("login");
                          setStep("login");
                        }
                      }
                    }}
                  >
                    <span>{t("auth.save_password", null, "Hoàn tất & Đăng nhập")}</span>
                    <ArrowRightIcon />
                  </button>

                  {error && <p className="auth-form-error">{error}</p>}
                </div>
              )}

              {/* Reset Request Step */}
              {step === "reset_request" && (
                <form className="auth-form" onSubmit={handleResetRequest}>
                  <div className="auth-field-group">
                    <label>{t("auth.reset_email", null, "Email đã đăng ký")}</label>
                    <div className="auth-input-wrapper with-icon">
                      <span className="auth-input-icon left"><MailIcon /></span>
                      <input name="email" type="email" placeholder={t("auth.reset_email_placeholder", null, "Nhập email của bạn")} required />
                    </div>
                  </div>
                  
                  <button className="auth-btn-primary" type="submit" disabled={loading}>
                    <span>{t("auth.reset_send", null, "Gửi mã xác thực")}</span>
                    <ArrowRightIcon />
                  </button>

                  <div className="auth-card-footer">
                    <button type="button" className="auth-link-btn" onClick={() => setStep("login")}>
                      {t("common.back", null, "Quay lại đăng nhập")}
                    </button>
                  </div>
                  {error && <p className="auth-form-error">{error}</p>}
                </form>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
