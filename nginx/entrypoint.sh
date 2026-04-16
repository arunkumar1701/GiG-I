#!/bin/sh
set -eu

CERT_DIR="/etc/nginx/certs"
CERT_FILE="${CERT_DIR}/tls.crt"
KEY_FILE="${CERT_DIR}/tls.key"

mkdir -p "${CERT_DIR}"

if [ ! -s "${CERT_FILE}" ] || [ ! -s "${KEY_FILE}" ]; then
  echo "Generating self-signed TLS certificate for local reverse proxy..."
  openssl req -x509 -nodes -newkey rsa:2048 \
    -days 365 \
    -subj "/CN=localhost" \
    -keyout "${KEY_FILE}" \
    -out "${CERT_FILE}"
fi

exec nginx -g "daemon off;"
