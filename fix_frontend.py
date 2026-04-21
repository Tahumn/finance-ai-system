import os

file_path = "c:/Users/NHU/finance-ai-system/docker-compose.yml"
with open(file_path, "r") as f:
    content = f.read()

frontend_block = """
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: finance-frontend
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - VITE_API_URL=http://localhost:8005/api/v1
    depends_on:
      - gateway
    profiles: ["micro"]
"""

if "finance-frontend" not in content:
    content = content.replace("volumes:", frontend_block + "\nvolumes:")
    with open(file_path, "w") as f:
        f.write(content)
