FROM docker.io/imbios/bun-node:latest-23-alpine AS base
WORKDIR /usr/src/app

FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev
RUN cd /temp/dev && bun install --frozen-lockfile

RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .
# RUN echo "SESSION_SECRET=$(head -c 64 /dev/random | base64)" > .env

ENV NODE_ENV=production
ENV SERVER_PRESET=bun
RUN chmod +x node_modules/.bin/*
RUN bun run test:ci
RUN bun --bun run build

FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/.env .
COPY --from=prerelease /usr/src/app/bun.lock .
COPY --from=prerelease /usr/src/app/package.json .
COPY --from=prerelease /usr/src/app/.vinxi .vinxi
COPY --from=prerelease /usr/src/app/.output .output

USER bun
EXPOSE 3000
ENTRYPOINT [ "bun", "--bun", "run", "start" ]