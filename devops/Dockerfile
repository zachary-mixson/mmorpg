FROM node:18
WORKDIR /app
COPY .. .
RUN pnpm install --frozen-lockfile
CMD ["pnpm", "dev"]
