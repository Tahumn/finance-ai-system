export default function DateRangeFilters({ start, end, onChange }) {
  return (
    <section className="filters">
      <div className="field">
        <label>Từ ngày</label>
        <input
          type="date"
          value={start}
          onChange={(event) => onChange({ start: event.target.value, end })}
        />
      </div>
      <div className="field">
        <label>Đến ngày</label>
        <input
          type="date"
          value={end}
          onChange={(event) => onChange({ start, end: event.target.value })}
        />
      </div>
    </section>
  );
}
