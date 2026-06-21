#!/usr/bin/env bash
# Lance un serveur HTTP local et ouvre le harnais de test dans le navigateur.
# Les modules ES (import/export) ne fonctionnent pas sous file://, d'où le serveur.
set -euo pipefail

PORT="${1:-8766}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

cd "$ROOT"
python3 -m http.server "$PORT" > /tmp/energy-card-serve.log 2>&1 &
SERVER_PID=$!

sleep 1
URL="http://localhost:${PORT}/test/harness.html"
echo "Harnais disponible sur ${URL} (Ctrl+C pour arrêter)"

if command -v open >/dev/null 2>&1; then
  open "$URL"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL"
fi

wait "$SERVER_PID"
