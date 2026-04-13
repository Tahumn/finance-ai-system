import { colorFor, onColor } from "../../utils/colors.js";
import { getCategoryPrefs } from "../../utils/userPrefs.js";
import { t } from "../../utils/i18n.js";

export default function CategoriesScreen({
  categories,
  onCreate,
  onBack,
  loading,
  userEmail,
  embedded = false,
  collapsible = false,
  collapsed = false,
  onToggle
}) {
  const categoryPrefs = getCategoryPrefs(userEmail);
  const handleCreate = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = form.get("name").trim();
    if (!name) return;
    onCreate(name);
    event.currentTarget.reset();
  };

  return (
    <section className={`panel ${embedded ? "embedded-panel" : ""}`}>
      <div className="panel-header">
        <h3>{t("categories.title")}</h3>
        <div className="panel-actions">
          {onBack && (
            <button className="ghost" onClick={onBack} type="button">
              {t("common.back")}
            </button>
          )}
          {collapsible && (
            <button
              className="chevron-btn"
              type="button"
              onClick={onToggle}
              aria-expanded={!collapsed}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  d="M6 9l6 6 6-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
      {!collapsed && (
        <>
          <form className="form" onSubmit={handleCreate}>
            <div className="row">
              <input name="name" type="text" placeholder={t("categories.input")} required />
              <button className="primary" type="submit" disabled={loading}>
                {t("categories.add")}
              </button>
            </div>
          </form>
          {categories.length === 0 ? (
            <p className="empty">{t("categories.empty")}</p>
          ) : embedded ? (
            <div className="category-picker categories-inline">
              {categories.map((category) => {
                const bg = colorFor(category.name, userEmail);
                return (
                  <div
                    key={category.id}
                    className="category-pill static color-pill"
                    style={{ "--pill-bg": bg, "--pill-fg": onColor(bg) }}
                  >
                    <span className="pill-icon" aria-hidden="true">
                      {categoryPrefs[category.name]?.icon || "🏷️"}
                    </span>
                    <span className="pill-text">{category.name}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="list">
              {categories.map((category) => (
                <div key={category.id} className="item-row">
                  <div className="category-row">
                    <span className="dot" style={{ background: colorFor(category.name, userEmail) }} />
                    {categoryPrefs[category.name]?.icon && (
                      <span className="tag-chip">{categoryPrefs[category.name].icon}</span>
                    )}
                    <p>{category.name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
