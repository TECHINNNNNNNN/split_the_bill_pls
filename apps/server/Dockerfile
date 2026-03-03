FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

# Install, build, and create standalone deployment
FROM base AS build
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo build --filter=@pladuk/server
RUN pnpm deploy --filter=@pladuk/server --prod --legacy /prod/server

# Run — clean image, no pnpm needed
FROM node:22-slim AS runner
WORKDIR /app
COPY --from=build /prod/server/node_modules ./node_modules
COPY --from=build /prod/server/package.json ./
COPY --from=build /app/apps/server/dist ./dist

EXPOSE 3001
CMD ["node", "dist/index.js"]
