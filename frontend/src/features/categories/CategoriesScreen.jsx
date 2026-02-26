import { colorFor } from "../../utils/colors.js";

export default function CategoriesScreen({
  categories,
  onCreate,
  onBack,
  loading,
  embedded = false
}) {
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
        <h3>Danh mục</h3>
        {onBack && (
          <button className="ghost" onClick={onBack} type="button">
            Quay lại
          </button>
        )}
      </div>
      <form className="form" onSubmit={handleCreate}>
        <div className="row">
          <input name="name" type="text" placeholder="Tên danh mục" required />
          <button className="primary" type="submit" disabled={loading}>
            Thêm danh mục
          </button>
        </div>
      </form>
      <div className="list">
        {categories.length === 0 ? (
          <p className="empty">Chưa có danh mục nào.</p>
        ) : (
          categories.map((category) => (
            <div key={category.id} className="item-row">
              <div className="category-row">
                <span className="dot" style={{ background: colorFor(category.name) }} />
                <p>{category.name}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
