FROM node:20-bullseye-slim

WORKDIR /app
ENV CI=true

# Enable corepack to get pnpm
RUN corepack enable

# Copy only manifests first for better layer caching
COPY package.json pnpm-lock.yaml ./

# Install with devDependencies so Mastra CLI is available during build
# Ignore lifecycle scripts at this stage to avoid postinstall before sources/scripts are copied
RUN pnpm i --frozen-lockfile --ignore-scripts

# Copy sources
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

# Copy n8n-mcp database (place your file at data/nodes.db in repo)
COPY data/nodes.db /app/data/nodes.db
ENV NODE_DB_PATH=/app/data/nodes.db

# Now that node_modules and scripts are present, perform the nodes.db patch
RUN node ./scripts/patch-n8n-db.mjs || echo "[docker] patch-n8n-db skipped"

# Build Mastra app
RUN pnpm build

# Runtime
ENV NODE_ENV=production
ENV PORT=4111
EXPOSE 4111

CMD ["pnpm", "start"]
