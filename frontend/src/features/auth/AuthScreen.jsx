import { useEffect, useState } from "react";

export default function AuthScreen({
  mode,
  setMode,
  onSubmit,
  onVerifyOtp,
  onResendOtp,
  onSetPassword,
  loading,
  error,
  notice
}) {
  const [step, setStep] = useState("form");
  const [pendingEmail, setPendingEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [registrationToken, setRegistrationToken] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    setStep("form");
    setPendingEmail("");
    setOtpCode("");
    setRegistrationToken("");
    setNewPassword("");
  }, [mode]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");

    if (mode === "register") {
      const first_name = String(form.get("first_name") || "");
      const last_name = String(form.get("last_name") || "");
      const phone = String(form.get("phone") || "");
      const result = await onSubmit({
        first_name,
        last_name,
        phone,
        email,
        password,
        mode
      });
      if (result?.next === "otp") {
        setPendingEmail(email);
        setStep("otp");
      }
      return;
    }

    await onSubmit({ email, password, mode });
  };

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

        {step === "form" && (
          <form className="form" onSubmit={handleSubmit}>
            {mode === "register" && (
              <>
                <div className="row">
                  <input name="first_name" type="text" placeholder="Họ" required />
                  <input name="last_name" type="text" placeholder="Tên" required />
                </div>
                <input name="phone" type="tel" placeholder="Số điện thoại" required />
              </>
            )}
            <input name="email" type="email" placeholder="Email" required />
            {mode === "login" && (
              <input name="password" type="password" placeholder="Mật khẩu" required />
            )}
            <button className="primary" type="submit" disabled={loading}>
              {mode === "register" ? "Gửi OTP" : "Đăng nhập"}
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
            <input
              name="otp"
              type="text"
              inputMode="numeric"
              placeholder="Nhập OTP"
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value)}
            />
            <button
              className="primary"
              type="button"
              disabled={loading || !otpCode.trim()}
              onClick={async () => {
                const result = await onVerifyOtp(pendingEmail, otpCode.trim());
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
            <button className="ghost" type="button" onClick={() => setStep("form")}>
              Đổi email
            </button>
            {error && <p className="form-error">{error}</p>}
            {notice && !error && <p className="form-note">{notice}</p>}
          </div>
        )}

        {step === "set_password" && (
          <div className="form">
            <p className="otp-hint">Email đã xác thực. Tạo mật khẩu để kích hoạt tài khoản.</p>
            <input
              name="new_password"
              type="password"
              placeholder="Mật khẩu mới"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <button
              className="primary"
              type="button"
              disabled={loading || !newPassword}
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
      </section>
    </main>
  );
}
