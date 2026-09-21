FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy application
COPY src ./src

# Create migrations directory
RUN mkdir -p migrations

EXPOSE 3000

CMD ["npm", "start"]
