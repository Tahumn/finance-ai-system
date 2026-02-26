import { useEffect, useMemo, useRef, useState } from "react";

const PASSWORD_RULES = [
  { label: "Tối thiểu 8 ký tự", test: (value) => value.length >= 8 },
  { label: "Có chữ cái", test: (value) => /[A-Za-z]/.test(value) },
  { label: "Có số hoặc ký tự đặc biệt", test: (value) => /[\d\W]/.test(value) }
];

const strengthLabel = (score) => {
  if (score <= 1) return "Yếu";
  if (score === 2) return "Trung bình";
  return "Mạnh";
};

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

  const passwordScore = useMemo(() => {
    return PASSWORD_RULES.reduce((acc, rule) => acc + (rule.test(newPassword) ? 1 : 0), 0);
  }, [newPassword]);

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

  const EyeIcon = ({ open }) => (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
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

  const PasswordField = ({
    value,
    onChange,
    placeholder,
    show,
    onToggle,
    name
  }) => (
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
        aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
      >
        <EyeIcon open={show} />
      </button>
    </div>
  );

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>Finance AI</h1>
        <p className="subhead">Quản lý tài chính cá nhân thông minh</p>
        <div className="auth-tabs">
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
            type="button"
          >
            Đăng nhập
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
            type="button"
          >
            Đăng ký
          </button>
        </div>

        {step === "register" && (
          <form className="form" onSubmit={handleRegisterSubmit}>
            <input
              name="full_name"
              type="text"
              placeholder="Họ và tên"
              maxLength={100}
              required
            />
            <input
              name="username"
              type="text"
              placeholder="Username"
              maxLength={100}
              required
            />
            <input name="email" type="email" placeholder="Email" required />
            <input name="phone" type="tel" placeholder="Số điện thoại (optional)" />
            <button className="primary" type="submit" disabled={loading}>
              Đăng ký (Gửi OTP)
            </button>
            <button className="ghost" type="button" onClick={() => setMode("login")}>
              Đăng nhập nếu đã có tài khoản
            </button>
            {error && <p className="form-error">{error}</p>}
            {notice && !error && <p className="form-note">{notice}</p>}
          </form>
        )}

        {step === "otp" && (
          <div className="form">
            <p className="otp-hint">
              OTP đã gửi đến <strong>{pendingEmail}</strong>
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
              Xác thực OTP
            </button>
            <button
              className="ghost"
              type="button"
              disabled={loading}
              onClick={() => onResendOtp(pendingEmail)}
            >
              Gửi lại OTP
            </button>
            <button className="ghost" type="button" onClick={() => setStep("register")}>
              Đổi email
            </button>
            {error && <p className="form-error">{error}</p>}
            {notice && !error && <p className="form-note">{notice}</p>}
          </div>
        )}

        {step === "set_password" && (
          <div className="form">
            <p className="otp-hint">Email đã xác thực. Tạo mật khẩu để kích hoạt tài khoản.</p>
            <PasswordField
              name="new_password"
              placeholder="Mật khẩu mới"
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
            <p className="meter-label">Độ mạnh: {strengthLabel(passwordScore)}</p>
            <PasswordField
              name="confirm_password"
              placeholder="Xác nhận mật khẩu"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              show={showConfirmPassword}
              onToggle={() => setShowConfirmPassword((prev) => !prev)}
            />
            {!confirmOk && confirmPassword && (
              <p className="form-error">Mật khẩu xác nhận không khớp.</p>
            )}
            <button
              className="primary"
              type="button"
              disabled={loading || !passwordOk || !confirmOk}
              onClick={async () => {
                const ok = await onSetPassword(registrationToken, newPassword);
                if (ok) setMode("login");
              }}
            >
              Lưu mật khẩu
            </button>
            <button className="ghost" type="button" onClick={() => setStep("otp")}>
              Quay lại OTP
            </button>
            {error && <p className="form-error">{error}</p>}
            {notice && !error && <p className="form-note">{notice}</p>}
          </div>
        )}

        {step === "login" && (
          <form className="form" onSubmit={handleLoginSubmit}>
            <input name="identifier" type="text" placeholder="Email hoặc username" required />
            <PasswordField
              name="password"
              placeholder="Mật khẩu"
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
              Ghi nhớ tôi
            </label>
            <button className="primary" type="submit" disabled={loading}>
              Đăng nhập
            </button>
            <button className="ghost" type="button" onClick={() => setMode("register")}>
              Đăng ký
            </button>
            <button className="ghost" type="button" onClick={() => setStep("reset_request")}>
              Quên mật khẩu
            </button>
            {error && <p className="form-error">{error}</p>}
            {notice && !error && <p className="form-note">{notice}</p>}
          </form>
        )}

        {step === "reset_request" && (
          <form className="form" onSubmit={handleResetRequest}>
            <input name="email" type="email" placeholder="Email khôi phục" required />
            <button className="primary" type="submit" disabled={loading}>
              Gửi OTP
            </button>
            <button className="ghost" type="button" onClick={() => setStep("login")}>
              Quay lại đăng nhập
            </button>
            {error && <p className="form-error">{error}</p>}
            {notice && !error && <p className="form-note">{notice}</p>}
          </form>
        )}

        {step === "reset_otp" && (
          <div className="form">
            <p className="otp-hint">
              OTP đã gửi đến <strong>{resetEmail}</strong>
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
              Xác thực OTP
            </button>
            <button
              className="ghost"
              type="button"
              disabled={loading}
              onClick={() => onResetStart(resetEmail)}
            >
              Gửi lại OTP
            </button>
            <button className="ghost" type="button" onClick={() => setStep("reset_request")}>
              Đổi email
            </button>
            {error && <p className="form-error">{error}</p>}
            {notice && !error && <p className="form-note">{notice}</p>}
          </div>
        )}

        {step === "reset_set_password" && (
          <div className="form">
            <p className="otp-hint">Tạo mật khẩu mới để đăng nhập.</p>
            <PasswordField
              name="reset_password"
              placeholder="Mật khẩu mới"
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
            <p className="meter-label">Độ mạnh: {strengthLabel(passwordScore)}</p>
            <PasswordField
              name="reset_confirm"
              placeholder="Xác nhận mật khẩu"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              show={showConfirmPassword}
              onToggle={() => setShowConfirmPassword((prev) => !prev)}
            />
            {!confirmOk && confirmPassword && (
              <p className="form-error">Mật khẩu xác nhận không khớp.</p>
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
              Lưu mật khẩu
            </button>
            <button className="ghost" type="button" onClick={() => setStep("reset_otp")}>
              Quay lại OTP
            </button>
            {error && <p className="form-error">{error}</p>}
            {notice && !error && <p className="form-note">{notice}</p>}
          </div>
        )}
      </section>
    </main>
  );
}
