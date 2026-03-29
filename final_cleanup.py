import os

# Use absolute path
path = r"c:\Users\NHU\finance-ai-system\app\ai_agent\service.py"

if not os.path.exists(path):
    print(f"ERROR: File not found at {path}")
    exit(1)

with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Find markers again (more robustly)
start_marker = "# [OLD_LOGIC_DELETED_P1]"
end_marker = "def _otsu_threshold("

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if start_marker in line:
        start_idx = i
    if end_marker in line:
        end_idx = i
        break # Take first occurrence after start_idx (or first in file)

if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
    # Delete from marker to just before _otsu_threshold
    # Keep some spacing
    new_lines = lines[:start_idx] + ["\n\n"] + lines[end_idx:]
    with open(path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)
    print(f"SUCCESS: Deleted {end_idx - start_idx} lines.")
else:
    print(f"FAILED: Markers not found correctly. start={start_idx}, end={end_idx}")
    # Print a few lines around where we expect them for debugging
    print("Sample lines 1380-1395:")
    print("".join(lines[1380:1395]))
