FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM gcr.io/distroless/cc-debian12
WORKDIR /app
COPY --from=build /app/dist/elysia-server ./elysia-server
ENV PORT=3000
EXPOSE 3000
CMD ["./elysia-server"]
