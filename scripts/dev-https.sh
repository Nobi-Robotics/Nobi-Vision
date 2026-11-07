#!/usr/bin/env bash
# Local HTTPS so a phone can open the camera and microphone.
# See README for mkcert (trusted cert) and tunnel options.
set -euo pipefail
cd "$(dirname "$0")/.."
echo ""
echo "Nobi Vision — HTTPS dev server"
echo "  This machine:  https://localhost:3000"
echo "  Phone on LAN:  https://<this-computer-LAN-ip>:3000"
echo "  Self-signed certificates must be accepted on the phone, or use mkcert / a tunnel."
echo ""
exec npx next dev --experimental-https --hostname 0.0.0.0 --port 3000
