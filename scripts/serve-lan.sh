#!/usr/bin/env bash
# One Galla server for every device on this Wi-Fi (Mac app, Windows app/VM, phones): a production build
# on http://<this-mac-ip>:3000 using the local MongoDB. Point every Galla app at the printed address.
set -euo pipefail
cd "$(dirname "$0")/.."
bash scripts/db.sh >/dev/null
IP="${LAN_IP:-$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')}"
[ -n "$IP" ] || { echo "Could not detect your Wi-Fi IP. Run: LAN_IP=192.168.x.x npm run serve:lan"; exit 1; }
mkdir -p .data
[ -f .data/dev-secret ] || openssl rand -base64 48 > .data/dev-secret
export MONGODB_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/stockpilot?replicaSet=rs0}"
export BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-$(cat .data/dev-secret)}"
export APP_URL="http://$IP:${PORT:-3000}"
export MAIL_SINK="${MAIL_SINK:-file}"
export ALLOW_PUBLIC_SIGNUP="${ALLOW_PUBLIC_SIGNUP:-true}"
export NEXT_DIST_DIR=.next-lan
[ "${SKIP_BUILD:-}" = 1 ] || npx next build
echo ""
echo "  Galla server for this network: $APP_URL"
echo "  Emails (verification links) are written to .data/mail.log"
echo ""
exec npx next start --hostname 0.0.0.0 --port "${PORT:-3000}"
