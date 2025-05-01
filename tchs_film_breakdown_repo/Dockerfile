# Multi-stage build for backend and frontend
FROM node:18-alpine AS build

# Backend
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm install
COPY backend .

# Frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend .
RUN npm run build

# ------ Runtime ------
FROM node:18-alpine
WORKDIR /app
COPY --from=build /app/backend ./backend
COPY --from=build /app/frontend/build ./backend/public
WORKDIR /app/backend
ENV PORT=8080
EXPOSE 8080
CMD ["node","server.js"]
