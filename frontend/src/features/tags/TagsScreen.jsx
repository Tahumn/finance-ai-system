import { useEffect, useState } from "react";

const storageKey = (email) => `finance_local_tags:${email || "guest"}`;

const emptyTag = { name: "", color: "#1565c0" };

export default function TagsScreen({ userEmail }) {
  const [tags, setTags] = useState([]);
  const [tagForm, setTagForm] = useState(emptyTag);
  const [editingTagId, setEditingTagId] = useState(null);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey(userEmail));
    if (!raw) {
      setTags([]);
      return;
    }
    try {
      setTags(JSON.parse(raw));
    } catch {
      setTags([]);
    }
  }, [userEmail]);

  useEffect(() => {
    localStorage.setItem(storageKey(userEmail), JSON.stringify(tags));
  }, [tags, userEmail]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const name = tagForm.name.trim();
    if (!name) return;

    const payload = {
      id: editingTagId || `tag-${Date.now()}`,
      name,
      color: tagForm.color
    };

    setTags((current) => {
      if (!editingTagId) return [payload, ...current];
      return current.map((item) => (item.id === editingTagId ? payload : item));
    });

    setEditingTagId(null);
    setTagForm(emptyTag);
  };

  const startEdit = (tag) => {
    setEditingTagId(tag.id);
    setTagForm({ name: tag.name, color: tag.color });
  };

  const removeTag = (id) => {
    setTags((current) => current.filter((tag) => tag.id !== id));
    if (editingTagId === id) {
      setEditingTagId(null);
      setTagForm(emptyTag);
    }
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Nhãn (Tags)</h3>
        <span className="badge">UI local</span>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        <div className="row">
          <label className="field">
            <span>Tên nhãn *</span>
            <input
              type="text"
              value={tagForm.name}
              onChange={(event) =>
                setTagForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Ví dụ: Công việc"
              required
            />
          </label>
          <label className="field">
            <span>Màu</span>
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
              Hủy sửa
            </button>
          )}
          <button className="primary" type="submit">
            {editingTagId ? "Lưu nhãn" : "Thêm nhãn"}
          </button>
        </div>
      </form>

      <div className="list">
        {!tags.length ? (
          <p className="empty">Chưa có nhãn nào. Bạn có thể tạo để phục vụ truy vấn NLP.</p>
        ) : (
          tags.map((tag) => (
            <article key={tag.id} className="item-row">
              <div className="tag-row">
                <span className="dot" style={{ background: tag.color }} />
                <strong>{tag.name}</strong>
              </div>
              <div className="row-actions">
                <button className="ghost" type="button" onClick={() => startEdit(tag)}>
                  Sửa
                </button>
                <button className="ghost danger" type="button" onClick={() => removeTag(tag.id)}>
                  Xóa
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
