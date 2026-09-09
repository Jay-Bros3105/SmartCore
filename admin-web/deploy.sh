#!/usr/bin/env bash
# Deploy Neo-SmartCore Admin → Firebase Hosting (site: smartcore-6673d)
set -e
cd "$(dirname "$0")"

echo "→ Building static export (out/)..."
rm -rf out
npm run build

echo "→ Deploying to Firebase Hosting (smartcore-6673d)..."
./node_modules/.bin/firebase deploy --only hosting ${FIREBASE_TOKEN:+--token "$FIREBASE_TOKEN"}

echo "✔ Done. URL: https://smartcore-6673d.web.app"