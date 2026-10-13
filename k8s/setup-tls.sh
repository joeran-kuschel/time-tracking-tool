#!/bin/bash
# Creates a certificate for $TLS_HOST with mkcert and stores it as the TLS Secret that k8s/ingress.yaml uses.
# Run it after the namespace exists and before the ingress is applied. Does nothing while the Secret's
# certificate is valid for more than 30 days; --force creates a new one anyway (e.g. after changing TLS_HOST).
set -euo pipefail
source "$(dirname "$0")/db-common.sh"
TLS_HOST="${TLS_HOST:-time-tracking.local}"
TLS_SECRET="${TLS_SECRET:-time-tracking-tls}"
MIN_VALID_SECONDS=$((30 * 24 * 60 * 60))

if ! command -v mkcert > /dev/null; then
  echo "mkcert is required: brew install mkcert" >&2
  exit 1
fi

kube() { kubectl --context "$KUBE_CONTEXT" -n "$NAMESPACE" "$@"; }

force=false
case "$#:${1:-}" in
  0:) ;;
  1:--force) force=true ;;
  *) echo "Usage: $0 [--force]" >&2; exit 2 ;;
esac

# Fails here, before the trust store is touched, if the cluster or the namespace is missing
kube get namespace "$NAMESPACE" > /dev/null

if ! $force; then
  current="$(kube get secret "$TLS_SECRET" -o jsonpath='{.data.tls\.crt}' 2> /dev/null || true)"
  if [ -n "$current" ] \
    && printf '%s' "$current" | base64 --decode | openssl x509 -noout -checkend "$MIN_VALID_SECONDS" > /dev/null 2>&1; then
    echo "Secret $TLS_SECRET is up to date"
    exit 0
  fi
fi

# Adds mkcert's local CA to the system trust store (asks for your password the first time)
mkcert -install

dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
mkcert -cert-file "$dir/tls.crt" -key-file "$dir/tls.key" "$TLS_HOST"
kube create secret tls "$TLS_SECRET" --cert="$dir/tls.crt" --key="$dir/tls.key" --dry-run=client -o yaml \
  | kube apply -f -
echo "Secret $TLS_SECRET written for $TLS_HOST"
