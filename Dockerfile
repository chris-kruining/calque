FROM docker.io/denoland/deno:latest AS base
WORKDIR /usr/src/app

FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json deno.lock /temp/dev
RUN cd /temp/dev && deno install --frozen

RUN mkdir -p /temp/prod
COPY package.json deno.lock /temp/prod/
RUN cd /temp/prod && deno install --frozen

FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .
RUN echo "SESSION_SECRET=$(head -c 64 /dev/random | base64)" > .env

ENV NODE_ENV=production
ENV SERVER_PRESET=deno
RUN deno run test
RUN chmod +x node_modules/.bin/*
RUN deno run build

FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/.env .
COPY --from=prerelease /usr/src/app/deno.lock .
COPY --from=prerelease /usr/src/app/package.json .
COPY --from=prerelease /usr/src/app/.vinxi .vinxi
COPY --from=prerelease /usr/src/app/.output .output

USER deno
EXPOSE 3000
ENTRYPOINT [ "deno", "run", "start" ]