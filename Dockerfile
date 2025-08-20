FROM node:20-bullseye-slim

WORKDIR /app
ENV CI=true

# Enable corepack to get pnpm
RUN corepack enable

# Copy only manifests first for better layer caching
COPY package.json pnpm-lock.yaml ./

# Install with devDependencies so Mastra CLI is available during build
RUN pnpm i --frozen-lockfile

# Copy sources
COPY tsconfig.json ./
COPY src ./src

# Build Mastra app
RUN pnpm build

# Runtime
ENV NODE_ENV=production
ENV PORT=4111
EXPOSE 4111

CMD ["pnpm", "start"]
