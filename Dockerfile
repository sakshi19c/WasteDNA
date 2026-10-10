# One container serves the API and the built React client.
FROM node:22-slim AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:22-slim
WORKDIR /app
COPY server/package*.json server/
RUN cd server && npm ci --omit=dev
COPY server/ server/
COPY --from=client /app/client/dist client/dist
ENV NODE_ENV=production AUTO_INIT=true
EXPOSE 5000
CMD ["node", "server/server.js"]
