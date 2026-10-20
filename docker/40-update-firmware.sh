#!/bin/sh
# Runs when the container starts (nginx image entrypoint hook). Refreshes the
# firmware served at /firmware from the latest GitHub release, so a new
# release only needs a container restart instead of a rebuild. Keeps the
# files from the image (or the previous start) if the download fails.

set -u

FIRMWARE_REPO="${FIRMWARE_REPO:-tiralmos/bike-tracker}"
FIRMWARE_DIR=/usr/share/nginx/html/firmware
TMP_DIR=$(mktemp -d)

for file in manifest.json firmware.factory.bin firmware.ota.bin; do
  if ! curl -fsSL -o "$TMP_DIR/$file" "https://github.com/${FIRMWARE_REPO}/releases/latest/download/$file"; then
    echo "update-firmware: could not download $file, keeping the current firmware"
    rm -rf "$TMP_DIR"
    exit 0
  fi
done

mkdir -p "$FIRMWARE_DIR"
mv "$TMP_DIR"/* "$FIRMWARE_DIR"/
rm -rf "$TMP_DIR"
echo "update-firmware: serving $(grep -o '"version": *"[^"]*"' "$FIRMWARE_DIR/manifest.json")"
