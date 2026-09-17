# Neo SmartCore — Push Relay (Vercel)

Relay ndogo ambayo inapeleka **push notifications** kwa admin (web) na wasimamizi
milengo (Android) bila Cloud Functions — inafanya kazi kwenye **Firebase Spark**
(hakuna kadi, hakuna Blaze). Inaendesha kwenye **Vercel (Hobby = free)**.

Inapokea `POST /api/notify` kutoka app (manager) na admin web, kisha inatumia
firebase-admin kutuma FCM:

- `stock_request` / `stock_receiving` / `expense` / `closing` /
  `reconciliation` / `shop_change` → **"… From Duka X — Pending Approval"** (kwa admin)
- `closing` + item zilizobaki **≤ 5** → **"Insufficient Products in Duka X — Please Adjust Stock"**
- `…_approved` → **"Admin's Approval Success — …"** (kwa msimamizi aliyetuma)

## Endpoints za Vercel

| Endpoint | Kazi |
|---|---|
| `GET  /api/health` | unaangalia relay iko (rudisha `{ok:true}`) |
| `POST /api/notify` | kutuma notifications |
| `POST /notify`, `GET /health` | aliases (vercel.json) — kwa kompati na Glitch |

## Kuweka kwenye Vercel (njia kuu — Glitch imezuia hosting, Vercel ni free)

1. **Create service account key**
   Firebase Console → ⚙ Project settings → **Service accounts** →
   **Generate new private key** → pakua `serviceAccountKey.json`.

2. **Base64 ya key** (ili `\n` za private_key zisitupe shida):
   ```bash
   base64 -w0 serviceAccountKey.json
   ```
   (Windows PowerShell): `[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\serviceAccountKey.json"))`

3. **Anzisha project ya Vercel** mojawapo kati ya hizo mbili:
   - **Via dashboard:** vercel.com → New Project → *Import* repo ya GitHub:
     weka **Root Directory = `relay`** → Deploy. (Hakikisha umesha-push
     `relay/` kwenye GitHub, au upload zip.)
   - **Via CLI:** `npm i -g vercel` kikonandoa, kasha ndani ya `relay/`:
     ```bash
     vercel --prod
     ```

4. **Weka env variables** kwenye Vercel (dashboard → Project → Settings →
   **Environment Variables**, au `vercel env add`):
   ```
   FIREBASE_SERVICE_ACCOUNT_B64=<result ya base64 kutoka hatua 2>
   FIREBASE_PROJECT_ID=smartcore-6673d
   ```
   → kasha **Redeploy** (`vercel --prod`).

5. **Pata URL yako** — kwa hii project ni:
   `https://neosmartcore-relay-jay-bros3105s-projects.vercel.app`
   (production) — iko tayari kwenye `src/services/relayNotifications.ts` na
   `admin-web/lib/relay.ts` (<code>RELAY_URL</code>). Usiifute `vercel.json`/
   `functions` kwani ndiyo inawezesha endpoints.

6. **Taja**: `https://neosmartcore-relay.vercel.app/api/health` inarudisha
   `{ "ok": true, "service": "neosmartcore-relay" }`.

7. **Weka URL hiyo** kwenye:
   - `src/services/relayNotifications.ts` → `RELAY_URL`
   - `admin-web/lib/relay.ts` → `RELAY_URL`
   Kasha rebuild app yako na ku-redeploy admin web.
   (Kwa sasa URL kuu iko tayari ikiwa imewekwa — angalia hatua 5.)

## Maelezo muhimu (usisahau)

- **VAPID key** (Firebase Console → Project settings → **Cloud Messaging** →
  *Web push certificates*) — lazima iwekwe kwenye `admin-web/lib/firebase.ts`
  (`FIREBASE_VAPID_KEY`) ili browser ya admin ipate token.
- **google-services.json** — weka kwenye `android/app/google-services.json`
  (Firebase Console → Android app `com.jslfastline.neosmartcore`) ili FCM token
  ya app ya manager iweze kutengenezwa.
- Tokens zao zote zinaenda `deviceTokens/{userId}` — relay inazichukua hapo.
- Firebase service account key ni secret ya juu — **usiweke kwenye git**.
  Imezungukwa na `.gitignore`. Glitch inazuiwa → Vercel ndiyo msingi.
- Kwa deployment ya ndani (dev/test) ya Express relay bado unaweza kutumia
  `npm start` kwenye `relay/` — endpoint `POST /notify` na `GET /health` ziko.