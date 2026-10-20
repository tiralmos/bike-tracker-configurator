# Self-hosted Bike Tracker Configurator. Serves the web UI and the latest
# firmware release of tiralmos/bike-tracker (used by "Initial setup" and
# "Update firmware").

FROM node:24-alpine AS build

RUN npm i -g pnpm@11

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .

# Default API server shown in the configurator. Use your computer's address
# on your network (not localhost) so the display can reach it too.
ARG API_HOST=http://localhost:3000
ENV PUBLIC_API_HOST=${API_HOST}
ENV PUBLIC_GOOGLE_MAPS_API_KEY=""
RUN pnpm build

FROM alpine:3.22 AS firmware

ARG FIRMWARE_REPO=tiralmos/bike-tracker
RUN apk add --no-cache curl && mkdir /firmware
WORKDIR /firmware
RUN for file in manifest.json firmware.factory.bin firmware.ota.bin; do \
      curl -fsSL -o "$file" "https://github.com/${FIRMWARE_REPO}/releases/latest/download/$file" \
        || echo "WARNING: could not download $file; flashing from the configurator will not work until a firmware release exists"; \
    done

FROM nginx:1.29-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
COPY --from=firmware /firmware /usr/share/nginx/html/firmware
