import os

file_path = r'c:\Users\NHU\finance-ai-system\frontend\src\api\client.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Target only the request function's if (!response.ok) block
# but only if it doesn't already have the 401 handle.
# The requestForm one is already done.

target = """  if (!response.ok) {
    let message = payload?.detail || payload?.message || "Request failed";"""

replacement = """  if (!response.ok) {
    if (response.status === 401) {
      clearToken();
      window.dispatchEvent(new CustomEvent("finance:logout"));
    }
    let message = payload?.detail || payload?.message || "Request failed";"""

if target in content:
    # We only want to replace the first occurrence (which should be the request function)
    # because the second one (requestForm) already has it and won't match the target exactly.
    new_content = content.replace(target, replacement, 1)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Successfully patched request function in client.js")
else:
    print("Target not found in client.js. Checking if already patched...")
    if 'if (response.status === 401)' in content:
        print("Already patched or structure different.")
    else:
        print("Structure seems different. No changes made.")
