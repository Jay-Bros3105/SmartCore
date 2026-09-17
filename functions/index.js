/**
 * Neo SmartCore — Push Notifications Engine (Firebase Cloud Functions v2)
 *
 * 1. Ombi / request yoyote inapoingia (Stock Request, Stock Receiving, Expense,
 *    Closing, Cash Reconciliation, Shop Change, Registration) => msimamizi anapata
 *    "Pending Approval From Shop X".
 * 2. Stock ikiwa chini (remaining <= 5) kwenye Closing => msimamizi anapata
 *    "Insufficient Products in Shop X — Please Adjust Stock".
 * 3. Approval inapofanyika => msimamizi (manager) anapata "Admin's Approval Success".
 *
 * Device tokens huhifadhiwa kwenye `deviceTokens/{userId}` (app na admin web
 * zinajiandikisha kila zinapoanza).
 */
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const {
  onDocumentCreated,
  onDocumentUpdated,
} = require('firebase-functions/v2/firestore');

initializeApp();

const db = getFirestore();
const APP_NAME = 'Neo-SmartCore';
const LOW_QUANTITY_THRESHOLD = 5;
const DEVICE_TOKENS_COLLECTION = 'deviceTokens';
const ADMIN_COLLECTION = 'admins';

/** Title + body yote huenda kwa notification. Icon ya SmartCore kwa web. */
const NOTIFICATION_ICON = '/NeoSmartCore_Icon.png';
const BASELINE_LINK = 'https://smartcore-6673d.web.app';

function shopNameOf(data) {
  return String(data.shopName || data.branchName || data.shopId || 'Shop');
}

function managerIdOf(data) {
  return String(data.createdBy || data.userId || data.managerUserId || '');
}

async function tokensOfUser(uid) {
  if (!uid) return [];
  try {
    const snap = await db.collection(DEVICE_TOKENS_COLLECTION).doc(String(uid)).get();
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
    const admins = await db.collection(ADMIN_COLLECTION).get();
    const uids = admins.docs.map((d) => d.id);
    const out = [];
    for (const uid of uids) {
      out.push(...(await tokensOfUser(uid)));
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
    data: {
      title: APP_NAME,
      body,
      type,
      path: path || '/',
    },
    android: {
      priority: 'high',
      notification: {
        title: APP_NAME,
        body,
        sound: 'default',
        color: '#2BB6C9',
        priority: 'PRIORITY_HIGH',
        tag: String(type),
        clickAction: 'OPEN_NEOSMARTCORE',
      },
    },
    webpush: {
      headers: { TTL: '86400' },
      fcmOptions: { link: path ? `${BASELINE_LINK}${path}` : BASELINE_LINK },
      notification: {
        title: APP_NAME,
        body,
        icon: NOTIFICATION_ICON,
        badge: NOTIFICATION_ICON,
      },
    },
  };
}

async function send(tokens, message) {
  const unique = [...new Set(tokens)].filter(Boolean);
  if (unique.length === 0) return;
  try {
    const res = await getMessaging().sendEachForMulticast(message);
    res.responses.forEach((r, i) => {
      if (r.success) return;
      const code = r.error && r.error.code;
      if (code === 'messaging/registration-token-not-registered') {
        // Tokens zilizokufa zinatakiwa kuondolewa na client onTokenRefresh;
        // hapa tunaweka log tu (Firestore cleanup inahitaji uid).
      }
    });
  } catch (err) {
    console.error('FCM send failed:', err);
  }
}

async function notifyAdmins(body, type, path) {
  const tokens = await adminTokens();
  await send(tokens, buildMessage(tokens, { body, type, path }));
}

async function notifyUser(uid, body, type, path) {
  const tokens = await tokensOfUser(uid);
  await send(tokens, buildMessage(tokens, { body, type, path }));
}

function approvalLabel(col) {
  switch (col) {
    case 'closingReports': return 'Admin\'s Approval Success — Closing Approved';
    case 'stockReceiving': return 'Admin\'s Approval Success — Stock Receiving Approved';
    case 'stockRequests': return 'Admin\'s Approval Success — Stock Request Approved';
    case 'expenses': return 'Admin\'s Approval Success — Expense Approved';
    case 'cashReconciliations': return 'Admin\'s Approval Success — Cash Reconciliation Approved';
    case 'shopChangeRequests': return 'Admin\'s Approval Success — Shop Change Approved';
    default: return 'Admin\'s Approval Success';
  }
}

const APPROVAL_COLLECTIONS = [
  'closingReports',
  'stockReceiving',
  'stockRequests',
  'expenses',
  'cashReconciliations',
  'shopChangeRequests',
];

for (const col of APPROVAL_COLLECTIONS) {
  const name = `notifyManagerOn${col[0].toUpperCase()}${col.slice(1)}Approved`;
  exports[name] = onDocumentUpdated(`${col}/{id}`, async (event) => {
    const before = event.data.before.data() || {};
    const after = event.data.after.data() || {};
    const prevStatus = String(before.status || '');
    const nextStatus = String(after.status || '');
    if (prevStatus === nextStatus || nextStatus !== 'approved') return;
    await notifyUser(
      managerIdOf(after),
      approvalLabel(col),
      `${col}_approved`,
      col === 'cashReconciliations' ? '/reconcile' : col === 'closingReports' ? '/closings' : '/transactions'
    );
  });
}

/** Low stock check: items zilizobaki (remaining) <= 5. */
function lowStockItems(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((it) => {
    const remaining = Number(it.remaining ?? it.qty ?? 0);
    return remaining > 0 && remaining <= LOW_QUANTITY_THRESHOLD;
  });
}

/** Pending approvals → msimamizi. */
const PENDING_COLLECTIONS = [
  {
    col: 'stockRequests',
    body: (shop) => `Stock Request From ${shop}`,
    type: 'stock_request',
    path: '/transactions',
  },
  {
    col: 'stockReceiving',
    body: (shop) => `Stock Receiving From ${shop}`,
    type: 'stock_receiving',
    path: '/transactions',
  },
  {
    col: 'expenses',
    body: (shop) => `Expense (Money Out) From ${shop}`,
    type: 'expense',
    path: '/transactions',
  },
  {
    col: 'closingReports',
    body: (shop) => `Closing Report From ${shop}`,
    type: 'closing',
    path: '/closings',
  },
  {
    col: 'cashReconciliations',
    body: (shop) => `Cash Reconciliation From ${shop}`,
    type: 'reconciliation',
    path: '/reconcile',
  },
  {
    col: 'shopChangeRequests',
    body: (shop) => `Shop Change Request From ${shop}`,
    type: 'shop_change',
    path: '/#',
  },
  {
    col: 'pendingRegistrations',
    body: (shop) => `New Registration From ${shop}`,
    type: 'registration',
    path: '/registrations',
  },
];

for (const cfg of PENDING_COLLECTIONS) {
  const name = `notifyAdminOn${cfg.col[0].toUpperCase()}${cfg.col.slice(1)}Created`;
  exports[name] = onDocumentCreated(`${cfg.col}/{id}`, async (event) => {
    const data = event.data.data() || {};
    await notifyAdmins(`${cfg.body(shopNameOf(data))} — Pending Approval`, cfg.type, cfg.path);
  });
}

/** Closing submittion pia huangalia low stock → "Insufficient Products in Shop X". */
exports.notifyAdminLowStockOnClosing = onDocumentCreated(
  'closingReports/{id}',
  async (event) => {
    const data = event.data.data() || {};
    const low = lowStockItems(data.items);
    if (low.length === 0) return;
    const names = low.slice(0, 3).map((it) => String(it.name || 'item')).join(', ');
    const more = low.length > 3 ? ` +${low.length - 3} more` : '';
    await notifyAdmins(
      `Insufficient Products in ${shopNameOf(data)}: ${names}${more}. Please Adjust Stock`,
      'low_stock',
      '/stock'
    );
  }
);