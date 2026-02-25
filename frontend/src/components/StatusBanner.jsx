export default function StatusBanner({ loading, error }) {
  if (!loading && !error) return null;

  return (
    <div className={`status ${error ? "error" : "loading"}`}>
      {loading ? "Đang tải dữ liệu..." : error}
    </div>
  );
}
