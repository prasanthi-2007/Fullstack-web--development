const EXPENSES_API = "http://localhost:3001/expenses";
const SETTINGS_API = "http://localhost:3001/settings/1";
const CATEGORIES = ["Food", "Transport", "Education", "Entertainment", "Bills", "Other"];
const EMPTY_FORM = {
  title: "",
  amount: "",
  category: "Food",
  date: new Date().toISOString().slice(0, 10),
};

function App() {
  const [expenses, setExpenses] = React.useState([]);
  const [budget, setBudget] = React.useState(0);
  const [budgetInput, setBudgetInput] = React.useState("");
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [filter, setFilter] = React.useState("All");
  const [error, setError] = React.useState("");

  // Load expenses and budget from the JSON server
  const loadData = async () => {
    try {
      const [expRes, setRes] = await Promise.all([
        fetch(EXPENSES_API),
        fetch(SETTINGS_API),
      ]);
      if (!expRes.ok || !setRes.ok) throw new Error();
      setExpenses(await expRes.json());
      const settings = await setRes.json();
      setBudget(settings.monthlyBudget);
      setError("");
    } catch {
      setError("Could not reach the JSON server. Run: json-server --watch db.json --port 3001");
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  // Derived data: only expenses from the current month count toward the budget
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthExpenses = expenses.filter((e) => e.date.startsWith(currentMonth));
  const monthTotal = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const grandTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const remaining = budget - monthTotal;
  const usedPct = budget > 0 ? Math.min((monthTotal / budget) * 100, 100) : 0;

  let budgetClass = "";
  if (monthTotal > budget) budgetClass = "over";
  else if (usedPct >= 80) budgetClass = "warn";

  // Category totals for the summary card
  const categoryTotals = CATEGORIES.map((cat) => ({
    name: cat,
    total: expenses
      .filter((e) => e.category === cat)
      .reduce((sum, e) => sum + e.amount, 0),
  })).filter((c) => c.total > 0);

  // History: filtered and sorted newest first
  const visible = expenses
    .filter((e) => filter === "All" || e.category === filter)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Create
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || form.amount === "") return;

    const newExpense = {
      title: form.title.trim(),
      amount: Number(form.amount),
      category: form.category,
      date: form.date,
    };

    try {
      const res = await fetch(EXPENSES_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newExpense),
      });
      const created = await res.json();
      setExpenses((prev) => [...prev, created]);
      setForm(EMPTY_FORM);
    } catch {
      setError("Failed to add expense.");
    }
  };

  // Delete
  const handleDelete = async (id) => {
    try {
      await fetch(`${EXPENSES_API}/${id}`, { method: "DELETE" });
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch {
      setError("Failed to delete expense.");
    }
  };

  // Update monthly budget
  const handleBudgetSave = async (e) => {
    e.preventDefault();
    const value = Number(budgetInput);
    if (!value || value <= 0) return;

    try {
      await fetch(SETTINGS_API, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyBudget: value }),
      });
      setBudget(value);
      setBudgetInput("");
    } catch {
      setError("Failed to update budget.");
    }
  };

  return (
    <div className="container">
      <header>
        <h1>Student Expense Tracker</h1>
        <p>Track your spending and stay within budget</p>
      </header>

      {error && <div className="message">{error}</div>}

      <div className="stats">
        <div className="card">
          <div className="stat-value">${grandTotal.toFixed(2)}</div>
          <div className="stat-label">Total spending (all time)</div>
        </div>
        <div className="card">
          <div className="stat-value">${monthTotal.toFixed(2)}</div>
          <div className="stat-label">Spent this month</div>
        </div>
        <div className="card">
          <div className={`stat-value ${remaining < 0 ? "danger" : ""}`}>
            ${remaining.toFixed(2)}
          </div>
          <div className="stat-label">
            {remaining < 0 ? "Over budget" : "Remaining this month"}
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Monthly budget</h3>
        <div className="budget-row">
          <span>
            ${monthTotal.toFixed(2)} of ${budget.toFixed(2)} used
          </span>
          <form onSubmit={handleBudgetSave} className="budget-row">
            <input
              type="number"
              min="1"
              step="1"
              placeholder="New budget"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
            />
            <button type="submit" className="secondary">Update</button>
          </form>
        </div>
        <div className="budget-bar">
          <div className={`budget-fill ${budgetClass}`} style={{ width: `${usedPct}%` }} />
        </div>
        {budgetClass === "over" && (
          <p style={{ marginTop: "0.6rem", color: "#b91c1c" }}>
            You have exceeded your monthly budget.
          </p>
        )}
      </div>

      <div className="card">
        <h3>Add expense</h3>
        <form className="form-grid" onSubmit={handleAdd}>
          <input
            placeholder="What did you spend on?"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Amount"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <button type="submit">Add</button>
        </form>
      </div>

      <div className="card">
        <h3>Spending by category</h3>
        {categoryTotals.length === 0 ? (
          <div className="empty">No expenses yet.</div>
        ) : (
          <ul className="summary-list">
            {categoryTotals.map((c) => (
              <li key={c.name}>
                <span>{c.name}</span>
                <strong>${c.total.toFixed(2)}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3>Expense history</h3>
        <div className="chips">
          {["All", ...CATEGORIES].map((c) => (
            <button
              key={c}
              className={`chip ${filter === c ? "active" : ""}`}
              onClick={() => setFilter(c)}
            >
              {c}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="empty">No expenses in this category.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => (
                <tr key={e.id}>
                  <td>{e.date}</td>
                  <td>{e.title}</td>
                  <td>
                    <span className="tag">{e.category}</span>
                  </td>
                  <td>${e.amount.toFixed(2)}</td>
                  <td>
                    <button className="danger" onClick={() => handleDelete(e.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);