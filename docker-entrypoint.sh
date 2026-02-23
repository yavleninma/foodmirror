#!/bin/sh
set -e
npx prisma migrate deploy
if [ $# -gt 0 ]; then
  exec "$@"
else
  exec node dist/index.js
fi
