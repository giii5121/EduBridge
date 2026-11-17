FROM node:24-bookworm-slim AS client-build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci
COPY client client
COPY shared shared
RUN npm run build

FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4000 DATABASE_PATH=/data/edubridge.sqlite SEED_DEMO=false
WORKDIR /app/server
COPY --chown=node:node server/package.json ./package.json
COPY --chown=node:node server/src ./src
COPY --chown=node:node shared /app/shared
COPY --from=client-build --chown=node:node /app/client/dist /app/client/dist
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=12s --start-period=40s CMD node -e "fetch('http://127.0.0.1:4000/api/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/index.js"]
