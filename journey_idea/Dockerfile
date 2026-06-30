# Stage 1: Build/Compile the scripts
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Final runner image
FROM grafana/k6:latest
WORKDIR /home/k6
# Copy the compiled bundled JS file from the builder stage
COPY --from=builder /app/dist/main.js ./main.js
ENTRYPOINT ["k6", "run", "main.js"]