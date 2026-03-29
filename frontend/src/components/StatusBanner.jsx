import { t } from "../utils/i18n.js";

export default function StatusBanner({ loading, error }) {
  if (!loading && !error) return null;

  return (
    <div className={`status ${error ? "error" : "loading"}`}>
      {loading ? t("status.loading", null, "Đang tải dữ liệu...") : error}
    </div>
  );
}
