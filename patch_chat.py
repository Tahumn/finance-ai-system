import os

file_path = "app/ai_agent/service.py"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Find the marker
start_line = -1
for i, line in enumerate(lines):
    if "# --- THE REST OF OLD LOGIC TO BE DELETED ---" in line:
        start_line = i
        break

# Find the next function start
end_line = -1
for i in range(start_line + 1, len(lines)):
    if "def _otsu_threshold(" in lines[i]:
        end_line = i
        break

if start_line != -1 and end_line != -1:
    # Delete everything from start_line up to end_line (exclusive)
    # Actually, we want to keep the space between them, maybe leave 2 newlines.
    new_lines = lines[:start_line] + ["\n\n"] + lines[end_line:]
    with open(file_path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)
    print(f"SUCCESS: Deleted old logic from line {start_line+1} to {end_line}.")
else:
    print(f"ERROR: Markers not found. start={start_line}, end={end_line}")
