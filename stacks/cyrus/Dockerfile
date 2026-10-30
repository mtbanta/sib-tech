# Stack C (cyrus) worker image. Node 24 runs the TypeScript directly, so there is no build step.
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production TZ=UTC
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY db ./db
CMD ["node", "src/main.ts"]
