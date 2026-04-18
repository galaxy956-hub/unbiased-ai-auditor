FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy dependency manifests first (better layer caching)
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy the rest of the app
COPY . .

# Cloud Run injects PORT; default 8080
ENV PORT=8080
EXPOSE 8080

# Run as non-root user for security
USER node

CMD ["node", "server.js"]
