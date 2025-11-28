# Dockerfile for React Native (Expo) mobile app
FROM node:20-alpine

WORKDIR /app/mobile

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 8081 19000 19001 19002 19006

CMD ["npx", "expo", "start", "--non-interactive"]