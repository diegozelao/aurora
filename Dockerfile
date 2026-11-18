FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY front/package*.json front/
COPY back/package*.json back/
RUN npm install --include=optional --force

COPY front front
COPY back back
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=80

COPY package*.json ./
COPY back/package*.json back/
RUN npm install --omit=dev

COPY --from=build /app/back ./back
COPY --from=build /app/front/dist ./front/dist

EXPOSE 80
CMD ["node", "back/server.js"]
