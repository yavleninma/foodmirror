#!/usr/bin/env bash
# SSH tunnel to Metabase on a remote droplet.
# Edit DROPLET_IP and SSH_USER before running.
# Usage: ./scripts/ssh-tunnel-metabase.sh
# Then open http://localhost:3040 in browser. Keep the terminal open.

set -euo pipefail

DROPLET_IP="${DROPLET_IP:-}"
SSH_USER="${SSH_USER:-root}"
METABASE_PORT="${METABASE_PORT:-3040}"

if [ -z "$DROPLET_IP" ]; then
  echo "Set DROPLET_IP: export DROPLET_IP=1.2.3.4"
  echo "Or edit this script and set DROPLET_IP at the top."
  exit 1
fi

echo "Tunneling localhost:${METABASE_PORT} -> ${SSH_USER}@${DROPLET_IP}:${METABASE_PORT}"
echo "Open http://localhost:${METABASE_PORT} in your browser. Press Ctrl+C to stop."
exec ssh -L "${METABASE_PORT}:localhost:${METABASE_PORT}" "${SSH_USER}@${DROPLET_IP}"
