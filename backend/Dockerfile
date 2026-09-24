FROM node:24-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy application and the fonts of the PDF report
COPY src ./src
COPY assets ./assets

# Create migrations directory
RUN mkdir -p migrations

EXPOSE 3000

CMD ["npm", "start"]
