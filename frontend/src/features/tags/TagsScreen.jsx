import { useState } from "react";
import { onColor } from "../../utils/colors.js";
import { t } from "../../utils/i18n.js";

const emptyTag = { name: "", color: "#1565c0" };

export default function TagsScreen({
  tags = [],
  onCreate,
  onUpdate,
  onDelete,
  embedded = false,
  loading = false,
  collapsible = false,
  collapsed = false,
  onToggle
}) {
  const [tagForm, setTagForm] = useState(emptyTag);
  const [editingTagId, setEditingTagId] = useState(null);

  const handleSubmit = (event) => {
    event.preventDefault();
    const name = tagForm.name.trim();
    if (!name) return;
    const payload = { name, color: tagForm.color };
    if (editingTagId) {
      onUpdate?.(editingTagId, payload);
    } else {
      onCreate?.(payload);
    }
    setEditingTagId(null);
    setTagForm(emptyTag);
  };

  const startEdit = (tag) => {
    setEditingTagId(tag.id);
    setTagForm({ name: tag.name, color: tag.color });
  };

  const removeTag = (id) => {
    onDelete?.(id);
    if (editingTagId === id) {
      setEditingTagId(null);
      setTagForm(emptyTag);
    }
  };

  return (
    <section className={`panel ${embedded ? "embedded-panel" : ""}`}>
      <div className="panel-header">
        <h3>{t("tags.title")}</h3>
        <div className="panel-actions">
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
          <form className="form" onSubmit={handleSubmit}>
            <div className="row">
              <label className="field">
                <span>{t("tags.form.name")}</span>
                <input
                  type="text"
                  value={tagForm.name}
                  onChange={(event) =>
                    setTagForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder={t("tags.form.name_placeholder")}
                  required
                />
              </label>
              <label className="field">
                <span>{t("tags.form.color")}</span>
                <input
                  type="color"
                  value={tagForm.color}
                  onChange={(event) =>
                    setTagForm((current) => ({ ...current, color: event.target.value }))
                  }
                />
              </label>
            </div>
            <div className="row-actions">
              {editingTagId && (
                <button
                  className="ghost"
                  type="button"
                  onClick={() => {
                    setEditingTagId(null);
                    setTagForm(emptyTag);
                  }}
                >
                  {t("tags.action.cancel_edit")}
                </button>
              )}
              <button className="primary" type="submit" disabled={loading}>
                {editingTagId ? t("tags.action.save") : t("tags.action.add")}
              </button>
            </div>
          </form>

          {!tags.length ? (
            <p className="empty">{t("tags.empty")}</p>
          ) : (
            <div className="tag-cloud" role="list">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  role="listitem"
                  className={`tag-pill color-pill ${editingTagId === tag.id ? "editing" : ""}`}
                  style={{ "--pill-bg": tag.color, "--pill-fg": onColor(tag.color) }}
                >
                  <button
                    className="tag-pill-main"
                    type="button"
                    onClick={() => startEdit(tag)}
                    aria-label={`${t("tags.action.edit")} ${tag.name}`}
                  >
                    <span className="pill-text">{tag.name}</span>
                  </button>
                  <button
                    className="tag-pill-remove"
                    type="button"
                    onClick={() => removeTag(tag.id)}
                    aria-label={`${t("tags.action.delete")} ${tag.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
