FROM node:18-alpine

WORKDIR /app

# Install dependencies first for better caching
COPY package.json package-lock.json ./
RUN npm install

# Copy source code
COPY . .

# Expose Vite's default port
EXPOSE 5173

# Start Vite dev server on all network interfaces so it's accessible outside the container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
