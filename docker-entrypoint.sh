#!/bin/sh
set -e

echo "======================================================="
echo "  CodeRoom — MERN server starting"
echo "  MongoDB: ${MONGODB_URI:-mongodb://mongo:27017/coderoom}"
echo "  Port:    ${PORT:-3000}"
if [ -n "$PUBLIC_BASE_URL" ]; then
  echo "  Public:  $PUBLIC_BASE_URL"
else
  echo "  Public:  (not configured — invitation links disabled)"
fi
echo "======================================================="

# Optional: seed demo users and room on first boot.
if [ "$SEED_DATABASE" = "true" ] || [ "$SEED_DEMO_DATA" = "true" ]; then
  echo "[seed] Loading demo data (idempotent)..."
  attempt=1
  while [ "$attempt" -le 10 ]; do
    if node dist/seed.js; then
      echo "[seed] Demo data ready."
      break
    fi
    echo "[seed] MongoDB not ready yet (attempt ${attempt}/10), retrying in 3s..."
    attempt=$((attempt + 1))
    sleep 3
  done
fi

# Execute the application command (defaults to node dist/index.js).
exec "$@"
