FROM node:20-bullseye-slim

WORKDIR /app
ENV CI=true

# Enable corepack to get pnpm
RUN corepack enable

# Install system dependencies needed to build native modules and clone repos
RUN apt-get update && \
    apt-get install -y --no-install-recommends git python3 make g++ ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Copy only manifests first for better layer caching
COPY package.json pnpm-lock.yaml ./

# Install with devDependencies so Mastra CLI is available during build
# Ignore lifecycle scripts at this stage to avoid postinstall before sources/scripts are copied
RUN pnpm i --frozen-lockfile --ignore-scripts

# Copy sources
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

# Build Mastra app
RUN pnpm build

# --- Embed n8n-mcp for stdio transport ---
# Clone and build nextMastraN8N so Mastra can launch it as a local stdio server
RUN git clone https://github.com/Bakhitov/nextMastraN8N /app/n8n-mcp && \
    cd /app/n8n-mcp && \
    npm ci --no-audit --no-fund && \
    npm run build

# Point Mastra MCP client to local n8n-mcp path (stdio mode)
ENV N8N_MCP_LOCAL_PATH=/app/n8n-mcp

# Runtime
ENV NODE_ENV=production
ENV PORT=4111
EXPOSE 4111

CMD ["pnpm", "start"]
