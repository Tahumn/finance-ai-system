import { currency, formatDateFull, formatTime } from "../utils/format.js";
import { colorFor, onColor } from "../utils/colors.js";
import { getCategoryPrefs } from "../utils/userPrefs.js";

export default function TransactionRow({ item, categoryLabel, userEmail }) {
  const displayCategory = categoryLabel || "Không danh mục";
  const categoryName = categoryLabel || "";
  const hasCategory = Boolean(item.category_id) && Boolean(categoryName);
  const categoryPrefs = getCategoryPrefs(userEmail);
  const icon = (hasCategory && categoryPrefs[categoryName]?.icon) || "🏷️";
  const bg = hasCategory ? colorFor(categoryName, userEmail) : "";
  const fg = hasCategory ? onColor(bg) : "";
  const time = formatTime(item.date);
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const visibleTags = tags.slice(0, 3);
  const extraCount = tags.length - visibleTags.length;

  return (
    <div className="tx-row">
      <div className="tx-main">
        <div
          className={`tx-badge ${hasCategory ? "color-pill" : ""}`}
          style={hasCategory ? { "--pill-bg": bg, "--pill-fg": fg } : undefined}
          aria-hidden="true"
        >
          <span className="tx-icon">{icon}</span>
        </div>

        <div className="tx-info">
          <div className="tx-top">
            <p className="tx-desc">{item.description}</p>
            <strong className={`tx-amount ${item.transaction_type === "income" ? "income" : "expense"}`}>
              {currency(item.amount)}
            </strong>
          </div>

          <div className="tx-meta">
            <span className="tx-category">{displayCategory}</span>
            <span aria-hidden="true">•</span>
            <span className="tx-date">
              {formatDateFull(item.date)}
              {time ? ` ${time}` : ""}
            </span>
          </div>

          {visibleTags.length ? (
            <div className="tx-tags">
              {visibleTags.map((tag) => (
                <span
                  key={tag.id || tag.name}
                  className="tag-chip color-pill"
                  style={{ "--pill-bg": tag.color || "#1565c0", "--pill-fg": onColor(tag.color || "#1565c0") }}
                >
                  <span className="pill-text">{tag.name}</span>
                </span>
              ))}
              {extraCount > 0 ? <span className="tx-more">+{extraCount}</span> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
