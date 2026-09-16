# frontend/Dockerfile
FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 4173

# Default command
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"]
