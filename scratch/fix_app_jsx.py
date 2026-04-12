import os

path = r"c:\School\CNLTHD\DoAn\finance-ai-system\frontend\src\App.jsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace state
if 'const [view, setView] = useState("dashboard");' in content:
    content = content.replace(
        'const [view, setView] = useState("dashboard");',
        'const [view, setView] = useState("dashboard");\n  const [initialChatQuery, setInitialChatQuery] = useState(null);'
    )
elif 'const [view, setView] = useState(\"dashboard\");' in content:
     content = content.replace(
        'const [view, setView] = useState(\"dashboard\");',
        'const [view, setView] = useState(\"dashboard\");\n  const [initialChatQuery, setInitialChatQuery] = useState(null);'
    )

# Replace handleChangeView
# This one is trickier because of multiline. I'll use a more generic replace.
old_func = """  const handleChangeView = (nextView) => {
    if (view === "onboarding") return;
    if (!isAuthed && !["dashboard", "settings"].includes(nextView)) {
      setAuthMode("login");
      setView("auth");
      return;
    }
    if (!isAuthed && nextView === "settings") {
      setAuthMode("login");
      setView("auth");
      return;
    }
    setView(nextView);
  };"""

new_func = """  const handleChangeView = (nextView, query = null) => {
    if (view === "onboarding") return;
    if (!isAuthed && !["dashboard", "settings"].includes(nextView)) {
      setAuthMode("login");
      setView("auth");
      return;
    }
    if (!isAuthed && nextView === "settings") {
      setAuthMode("login");
      setView("auth");
      return;
    }
    setView(nextView);
    if ((nextView === "chat" || nextView === "dashboard") && query) {
      setInitialChatQuery(query);
    }
  };"""

# Try direct string replace first (ignoring \r)
if old_func.replace("\r", "") in content.replace("\r", ""):
    # Use index-based replacement to be safe with line endings
    start_idx = content.replace("\r", "").find(old_func.replace("\r", ""))
    end_idx = start_idx + len(old_func.replace("\r", ""))
    
    # Re-normalize content to without \r for easier indexing if needed, 
    # but let's just try direct replace on normalized versions.
    content = content.replace("\r", "").replace(old_func.replace("\r", ""), new_func)

# Replace FloatingChatbot props
old_bot = """      <FloatingChatbot
        isAuthed={authState.status === "authed"}
        userEmail={authState.user?.email}
      />"""

new_bot = """      <FloatingChatbot
        isAuthed={authState.status === "authed"}
        userEmail={authState.user?.email}
        summary={summary}
        transactions={transactionsWithLabels}
        breakdown={breakdownWithShare}
        initialQuery={initialChatQuery}
        onClearInitialQuery={() => setInitialChatQuery(null)}
        onCreateTransaction={handleCreateTransaction}
      />"""

if old_bot.replace("\r", "") in content.replace("\r", ""):
    content = content.replace("\r", "").replace(old_bot.replace("\r", ""), new_bot)

with open(path, "w", encoding="utf-8", newline="\n") as f:
    f.write(content)

print("Successfully updated App.jsx")
