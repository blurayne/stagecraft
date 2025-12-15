ARG VARIANT=amd64
ARG NODE_VERSION=20.9.0

FROM alpine:latest

RUN apk add sudo git bash curl tar xz openssl nodejs npm 

RUN --mount=type=bind,target=/host npm install -g playwright --install-links
RUN --mount=type=bind,target=/host npx playwright install chromium
RUN --mount=type=bind,target=/host,readwrite npm -g --no-package-lock --install-links --install-strategy=shallow install /host tsx