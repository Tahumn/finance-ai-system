import { t } from "../utils/i18n.js";

export default function DateRangeFilters({ start, end, onChange }) {
  return (
    <section className="filters date-range-filters">
      <div className="field">
        <label>{t("filters.from", null, "Từ ngày")}</label>
        <input
          type="date"
          value={start}
          onChange={(event) => onChange({ start: event.target.value, end })}
        />
      </div>
      <div className="field">
        <label>{t("filters.to", null, "Đến ngày")}</label>
        <input
          type="date"
          value={end}
          onChange={(event) => onChange({ start, end: event.target.value })}
        />
      </div>
    </section>
  );
}
