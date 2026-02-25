import { currency, formatDate } from "../utils/format.js";

export default function TransactionRow({ item, categoryLabel }) {
  return (
    <div className="tx-row">
      <div>
        <p>{item.description}</p>
        <small>
          {categoryLabel} · {formatDate(item.date)}
        </small>
      </div>
      <strong className={item.transaction_type === "income" ? "income" : "expense"}>
        {item.transaction_type === "income" ? "+" : "-"}
        {currency(item.amount)}
      </strong>
    </div>
  );
}
