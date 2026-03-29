import ast
with open('app/ai_agent/service.py', 'r', encoding='utf-8') as f:
    source = f.read()
module = ast.parse(source)
for node in module.body:
    if isinstance(node, ast.FunctionDef) and getattr(node, 'name', '') == 'answer_chat':
        print(f"Start: {node.lineno}, End: {node.end_lineno}")
