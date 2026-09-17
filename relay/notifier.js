/**
 * Neo SmartCore — relay notifier.
 *
 * Inachukua notification request kutoka app/admin web na kutuma push kupitia
 * firebase-admin (FCM HTTP v1). Haitegemei Cloud Functions, hivyo inafanya kazi
 * kwenye Firebase Spark bila kadi — inaendesha kwenye Glitch (au Vercel).
 *
 * Endpoint (POST JSON):
 * {
 *   secret: 'RELAY_SECRET' (hiari, ikijazwa lazima ifanane),
 *   to: 'admin' | 'manager',
 *   managerUserId: '...' (inahitajika ikiwa to='manager'),
 *   shopName: 'Duka X',
 *   kind: 'stock_request' | 'stock_receiving' | 'expense' | 'closing' |
 *         'reconciliation' | 'shop_change' | 'registration' |
 *         'closing_approved' | 'receiving_approved' | 'request_approved' |
 *         'expense_approved' | 'reconciliation_approved' | 'shop_change_approved',
 *   path: '/transactions' (kiungo cha web admin),
 *   items: [ { name, remaining } ] (kwa kind='closing', kwa low-stock check)
 * }
 */
let adminApp = null;

function getAdmin() {
  if (adminApp) return adminApp;
  const { initializeApp, cert } = require('firebase-admin/app');
  const credentials = loadCredentials();
  if (!credentials) return null;
  adminApp = initializeApp({
    credential: cert(credentials),
    projectId: process.env.FIREBASE_PROJECT_ID || credentials.project_id,
  });
  return adminApp;
}

function loadCredentials() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (b64) {
    try {
      return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    } catch {
      return null;
    }
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

const APP_NAME = 'Neo-SmartCore';
const LOW_QUANTITY_THRESHOLD = 5;
const NOTIFICATION_ICON = '/NeoSmartCore_Icon.png';
const BASELINE_LINK = 'https://smartcore-6673d.web.app';

const KIND_LABELS = {
  stock_request: (s) => `Stock Request From ${s}`,
  stock_receiving: (s) => `Stock Receiving From ${s}`,
  expense: (s) => `Expense (Money Out) From ${s}`,
  closing: (s) => `Closing Report From ${s}`,
  reconciliation: (s) => `Cash Reconciliation From ${s}`,
  shop_change: (s) => `Shop Change Request From ${s}`,
  registration: (s) => `New Registration From ${s}`,
  closing_approved: () => `Admin's Approval Success — Closing Approved`,
  receiving_approved: () => `Admin's Approval Success — Stock Receiving Approved`,
  request_approved: () => `Admin's Approval Success — Stock Request Approved`,
  expense_approved: () => `Admin's Approval Success — Expense Approved`,
  reconciliation_approved: () => `Admin's Approval Success — Cash Reconciliation Approved`,
  shop_change_approved: () => `Admin's Approval Success — Shop Change Approved`,
};

function shopNameOf(payload) {
  return String(payload.shopName || payload.shopId || 'Shop');
}

async function tokensOfUser(uid) {
  if (!uid) return [];
  try {
    const { getFirestore } = require('firebase-admin/firestore');
    const db = getFirestore(getAdmin());
    const snap = await db.collection('deviceTokens').doc(String(uid)).get();
    if (!snap.exists) return [];
    const list = snap.data().tokens;
    if (!Array.isArray(list)) return [];
    return list.filter((t) => typeof t === 'string' && t.length > 8);
  } catch {
    return [];
  }
}

async function adminTokens() {
  try {
    const { getFirestore } = require('firebase-admin/firestore');
    const db = getFirestore(getAdmin());
    const admins = await db.collection('admins').get();
    const out = [];
    for (const doc of admins.docs) {
      out.push(...(await tokensOfUser(doc.id)));
    }
    return [...new Set(out)];
  } catch {
    return [];
  }
}

function buildMessage(tokens, { body, type, path }) {
  return {
    tokens: [...new Set(tokens)],
    notification: { title: APP_NAME, body },
    data: { title: APP_NAME, body, type, path: path || '/' },
    android: {
      priority: 'high',
      notification: {
        title: APP_NAME,
        body,
        sound: 'default',
        color: '#2BB6C9',
priority: 'HIGH',
      tag: String(type),
      clickAction: 'OPEN_NEOSMARTCORE',
      },
    },
    webpush: {
      headers: { TTL: '86400' },
      fcmOptions: { link: path ? `${BASELINE_LINK}${path}` : BASELINE_LINK },
      notification: { title: APP_NAME, body, icon: NOTIFICATION_ICON, badge: NOTIFICATION_ICON },
    },
  };
}

async function send(tokens, buildArgs) {
  const unique = [...new Set(tokens)].filter(Boolean);
  if (unique.length === 0) return { ok: true, skipped: 'no-tokens' };
  const { getMessaging } = require('firebase-admin/messaging');
  const batch = await getMessaging(getAdmin()).sendEachForMulticast(
    buildMessage(unique, buildArgs)
  );
  const failed = [];
  batch.responses.forEach((r, i) => {
    if (!r.success) failed.push(r.error?.code || 'unknown');
  });
  return { ok: true, delivered: batch.successCount, failed };
}

/** Beri: relayLogs/<ts>-<rand> — inasaidia kuchunguza kwa mbali. */
async function logEvent(entry) {
  try {
    const { getFirestore } = require('firebase-admin/firestore');
    const db = getFirestore(getAdmin());
    await db.collection('relayLogs').doc(`${Date.now()}_${Math.floor(Math.random() * 1e6)}`).set({
      ...entry,
      at: new Date().toISOString(),
    });
  } catch {
    /* logging ni hiari — sitaki kuibamiza relay. */
  }
}

/** Items za low-stock (remaining <= 5) kwenye closing. */
function lowStockItems(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((it) => {
    const remaining = Number(it.remaining ?? it.qty ?? 0);
    return remaining > 0 && remaining <= LOW_QUANTITY_THRESHOLD;
  });
}

/**
 * Shina la kila notify. Hurudisha { ok, message }.
 * Ikiwa relay haijasanidiwa kikamilifu, inarudisha ok:false bila kurusha —
 * app ya msindikaji haisimami.
 */
async function notify(payload) {
  if (process.env.RELAY_SECRET && payload.secret !== process.env.RELAY_SECRET) {
    return { ok: false, message: 'Invalid relay secret.' };
  }
  const fileName = KIND_LABELS[payload.kind];
  if (!fileName) return { ok: false, message: `Unknown kind: ${payload.kind}` };

  const app = getAdmin();
  if (!app) {
    return {
      ok: false,
      message:
        'Relay env missing: weka FIREBASE_SERVICE_ACCOUNT_B64 (au FIREBASE_SERVICE_ACCOUNT_JSON) kwenye .env.',
    };
  }

  const shop = shopNameOf(payload);
  const label = typeof payload.label === 'string' && payload.label.trim()
    ? payload.label.trim()
    : fileName(shop);

  const to = payload.to === 'manager' ? 'manager' : 'admin';
  const type = String(payload.kind);
  const path = String(payload.path || '/');

  if (to === 'manager') {
    const body = `${label}.`;
    const uid = String(payload.managerUserId || '');
    const tokens = await tokensOfUser(uid);
    const result = await send(tokens, { body, type, path });
    await logEvent({ ev: 'notify', to, kind: payload.kind, shop, uid, tokenCount: tokens.length, result });
    return result;
  }

  // to === 'admin': pending approval.
  const pendingBody = `${label} — Pending Approval`;
  const tokens = await adminTokens();
  const result = await send(tokens, { body: pendingBody, type, path });
  await logEvent({ ev: 'notify', to, kind: payload.kind, shop, tokenCount: tokens.length, result });

  // Kind='closing': low stock check → "Insufficient Products in Shop X".
  if (payload.kind === 'closing') {
    const low = lowStockItems(payload.items);
    if (low.length > 0) {
      const names = low.slice(0, 3).map((it) => String(it.name || 'item')).join(', ');
      const more = low.length > 3 ? ` +${low.length - 3} more` : '';
      const lowTokens = await adminTokens();
      const lowResult = await send(lowTokens, {
        body: `Insufficient Products in ${shop}: ${names}${more}. Please Adjust Stock`,
        type: 'low_stock',
        path: '/stock',
      });
      await logEvent({ ev: 'low_stock', to, kind: payload.kind, shop, tokenCount: lowTokens.length, low, result: lowResult });
    }
  }

  return { ok: true };
}

module.exports = { notify, lowStockItems };