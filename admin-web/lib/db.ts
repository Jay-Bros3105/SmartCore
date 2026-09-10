/**
 * SAFU YA DATA — ADMIN WEB
 *
 * Hii ndiyo sehemu moja ambayo pages zote huuliza data.
 *
 *  - Ikiwa Firebase imeunganishwa (USE_FIREBASE=true + apiKey imewekwa),
 *    data inakuja/inaenda MOJA KWA MOJA Firestore → kila mabadiliko
 *    yanaonekana papo hapo kwenye admin web na app ya wasimamizi.
 *
 *  - Ikiwa bado si Firebire (kabla ya kuweka apiKey), inatumia localStorage
 *    ndani ya kivinjari hivi kwamba unaweza kuona flow nzima (fresh) bila
 *    mipangilio yoyote.
 */
import {
  isFirebaseConfigured,
  getAdminDb,
  COLLECTIONS,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  query,
  where,
} from './firebase';
import { formatTsh } from './data';

/* ============================================================ TYPES */
export type Geo = { lat: number; lng: number; place: string };
export type Shop = {
  id: string;
  name: string;
  address: string;
  region: string;
  location: Geo | null;
  status: 'active' | 'inactive';
  createdAt: string;
  /** UID wa admin anayesimamia duka hili (kwa multi-admin). */
  ownerUid?: string;
};
export type Product = {
  id: string;
  branchId: string;
  name: string;
  price: number;
  createdAt: string;
};
export type SaleTx = {
  id: string;
  branchId: string;
  productName: string;
  quantity: number;
  totalPrice: number;
  closedAt: string;
};

export type ManagerRegistration = {
  userId: string;
  fullName: string;
  phone: string;
  branchId: string;
  branchName: string;
  status: 'pending' | 'approved' | 'rejected';
  registeredAt: string;
};

export type AdminScope = {
  uid: string;
  email: string;
  name: string;
  /** 'all' = ana maduka yote (Super Admin). `string[]` = region zake tu. */
  regions: string[] | 'all';
};

export type ClosingItem = {
  name: string;
  /** Idadi iliyopo kwenye Current Stock (opening + ongezeko la siku). */
  current: number;
  price: number;
  /** Idadi iliyobaki (msimamizi aliandika) — ≤ current. */
  remaining: number;
  /** Sold = current − remaining. */
  sold: number;
  /** Pesa ya mauzo = sold × price. */
  revenue: number;
};

export type ClosingReport = {
  id: string;
  shopId: string;
  shopName: string;
  date: string;
  items: ClosingItem[];
  totalRevenue: number;
  status: 'pending_admin' | 'approved';
  managerName?: string;
  submittedAt?: string;
  approvedAt?: string;
};

export type CurrentStockItem = {
  name: string;
  qty: number;
  price: number;
};

export type CurrentStock = {
  id: string;
  shopId: string;
  shopName: string;
  date: string;
  items: CurrentStockItem[];
  createdAt?: string;
};

/** Safu za Opening Stock (bidhaa zilizobaki) za kila siku, kama row yake
 *  kivyake kwenye dashboard. Data inatoka kwenye openingStocks — ambayo ni
 *  matokeo ya LAST approval ya closing + marekebisho au receiving yeyote. */
export async function listOpenings(): Promise<OpeningStockDoc[]> {
  if (!isFirebaseConfigured()) return [];
  const snap = await getDocs(collection(getAdminDb(), COLLECTIONS.openingStocks));
  let out = snap.docs
    .map((d) => {
      const data = d.data() as Record<string, unknown>;
      const items = Array.isArray(data.items)
        ? (data.items as Record<string, unknown>[]).map((r) => ({
            name: String(r.name ?? ''),
            qty: Number(r.qty ?? 0),
            price: Number(r.price ?? 0),
          }))
        : [];
      return {
        id: d.id,
        shopId: String(data.shopId ?? ''),
        shopName: String(data.shopName ?? ''),
        date: String(data.date ?? ''),
        items,
        total: Number(data.total ?? 0) || items.reduce((s, it) => s + it.qty * it.price, 0),
        status: (String(data.status ?? 'generated') as OpeningStockDoc['status']) || 'generated',
        sourceClosingId: data.sourceClosingId ? String(data.sourceClosingId) : undefined,
        createdAt: data.createdAt ? String(data.createdAt) : undefined,
        confirmedAt: data.confirmedAt ? String(data.confirmedAt) : undefined,
        managerConfirmedByName: data.managerConfirmedByName ? String(data.managerConfirmedByName) : undefined,
      } as OpeningStockDoc;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.shopName.localeCompare(b.shopName));

  const ids = await scopedShopIds();
  if (ids) out = out.filter((r) => ids.has(r.shopId));
  return out;
}

/** Doc moja ya Opening Stock kwa id yake (kwa preview ya list ndefu). */
export async function getOpeningDoc(id: string): Promise<OpeningStockDoc | null> {
  if (!isFirebaseConfigured()) return null;
  const snap = await getDoc(doc(getAdminDb(), COLLECTIONS.openingStocks, id));
  if (!snap.exists()) return null;
  const d = snap;
  const data = d.data() as Record<string, unknown>;
  const items = Array.isArray(data.items)
    ? (data.items as Record<string, unknown>[]).map((r) => ({
        name: String(r.name ?? ''),
        qty: Number(r.qty ?? 0),
        price: Number(r.price ?? 0),
      }))
    : [];
  return {
    id: d.id,
    shopId: String(data.shopId ?? ''),
    shopName: String(data.shopName ?? ''),
    date: String(data.date ?? ''),
    items,
    total: Number(data.total ?? 0) || items.reduce((s, it) => s + it.qty * it.price, 0),
    status: (String(data.status ?? 'generated') as OpeningStockDoc['status']) || 'generated',
    sourceClosingId: data.sourceClosingId ? String(data.sourceClosingId) : undefined,
    createdAt: data.createdAt ? String(data.createdAt) : undefined,
    confirmedAt: data.confirmedAt ? String(data.confirmedAt) : undefined,
    managerConfirmedByName: data.managerConfirmedByName ? String(data.managerConfirmedByName) : undefined,
  } as OpeningStockDoc;
}

export type OpeningStockDoc = {
  id: string;
  shopId: string;
  shopName: string;
  date: string;
  items: CurrentStockItem[];
  total: number;
  status: 'generated' | 'confirmed' | 'sent';
  sourceClosingId?: string;
  createdAt?: string;
  confirmedAt?: string;
  managerConfirmedByName?: string;
};

export const REGION_OPTIONS = [
  { value: 'mwanza', label: 'Mwanza' },
  { value: 'dar', label: 'Dar es Salaam' },
  { value: 'arusha', label: 'Arusha' },
  { value: 'morogoro', label: 'Morogoro' },
  { value: 'mbeya', label: 'Mbeya' },
  { value: 'tanga', label: 'Tanga' },
  { value: 'kilimanjaro', label: 'Kilimanjaro' },
  { value: 'other', label: 'Nyingine' },
];

export function regionLabel(region: string): string {
  return REGION_OPTIONS.find((r) => r.value === region)?.label ?? region;
}

/* ================================================ LOCAL (pre-Firebase) */
const LS = {
  shops: 'neo_db_shops',
  products: 'neo_db_products',
  transactions: 'neo_db_transactions',
  registrations: 'neo_db_registrations',
};

function lsRead<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}
function lsWrite<T>(key: string, arr: T[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(arr));
  window.dispatchEvent(new Event('neo-db-changed'));
}

let seq = 0;
function id(prefix: string) {
  return prefix + '-' + Date.now().toString(36) + '-' + (++seq).toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

/* ================================================ ADMIN SCOPE */
const SCOPE_KEY = 'neo_admin_scope';
const AUTH_KEY = 'neo_admin_authed';

export function saveScope(s: AdminScope) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SCOPE_KEY, JSON.stringify(s));
}

export function readScope(): AdminScope | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SCOPE_KEY);
    return raw ? (JSON.parse(raw) as AdminScope) : null;
  } catch {
    return null;
  }
}

/** Kikao cha tab hii tu: kufunga/open tab mpya → inabidi uingie tena (login first). */
export function isSessionAuthed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(AUTH_KEY) === '1';
  } catch {
    return false;
  }
}

export function markSessionAuthed() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(AUTH_KEY, '1');
  } catch {}
}

export function clearSessionAuthed() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(SCOPE_KEY);
  } catch {}
}

/** Baada ya login, soma (au unda) profile ya admin kwenye Firestore `users/{uid}`.
 *  Field `regions: ['mwanza', ...]` ndiyo inabainisha maduka yanayodhibitiwa.
 *  Ikiwa hakuna doc au regions haijawekwa → anapata maduka YOTE ('all'). */
export async function getAdminScope(uid: string, email: string): Promise<AdminScope> {
  const name = (email.split('@')[0] || 'Admin')
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  if (!isFirebaseConfigured()) return { uid, email, name, regions: 'all' };

  try {
    const ref = doc(getAdminDb(), 'users', uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const d = snap.data() as { regions?: string[] };
      ensureAdminDoc(uid, name, email);
      return {
        uid,
        email,
        name,
        regions: d.regions && d.regions.length ? d.regions : 'all',
      };
    }
    await setDoc(
      ref,
      {
        email,
        fullName: name,
        role: 'admin',
        regions: ['all'],
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    ).catch(() => {});
    ensureAdminDoc(uid, name, email);
    return { uid, email, name, regions: 'all' };
  } catch {
    return { uid, email, name, regions: 'all' };
  }
}

/** Weka doc ya admin kwenye `admins` — ndiyo inajenga orodha ya
 *  "Admin 1 / Admin 2 / ..." kwenye app wakati wa usajili. */
async function ensureAdminDoc(uid: string, name: string, email: string) {
  if (!isFirebaseConfigured()) return;
  await setDoc(
    doc(getAdminDb(), 'admins', uid),
    {
      uid,
      name,
      email,
      createdAt: new Date().toISOString(),
    },
    { merge: true }
  ).catch(() => {});
}

/** Region zilizoidhinishwa kwa admin aliyeingia; `null` = ana zote. */
function scopeRegions(): string[] | null {
  const s = readScope();
  if (!s) return null;
  return s.regions === 'all' ? null : s.regions;
}

/** UID wa admin aliyeingia (kutoka scope); `null` kama hakuna session. */
function myUid(): string | null {
  return readScope()?.uid ?? null;
}

/** Maduka ya admin aliyeingia = yale yale aliyo-yatengeneza (ownerUid === uid).
 *  Maduka bila ownerUid (data ya zamani) yanaonekana kwa wote hadi tumtaje mmiliki. */
function ownedShops(all: Shop[], uid: string): Shop[] {
  return all.filter((s) => !s.ownerUid || s.ownerUid === uid);
}

/* ======================================================== SHOPS */
export async function listShops(): Promise<Shop[]> {
  let all: Shop[];
  if (isFirebaseConfigured()) {
    const snap = await getDocs(collection(getAdminDb(), 'branches'));
    all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Shop, 'id'>) }));
  } else {
    all = lsRead<Shop>(LS.shops);
  }
  const uid = myUid();
  const mine = uid ? ownedShops(all, uid) : all;
  const regions = scopeRegions();
  if (!regions) return mine;
  return mine.filter((s) => s.region && regions.includes(s.region));
}

/** Ids za maduka kwa admin aliyeingia; `null` kama hakuna session (usi-filter). */
async function scopedShopIds(): Promise<Set<string> | null> {
  const uid = myUid();
  if (!uid) return null;
  const shops = await listShops();
  return new Set(shops.map((s) => s.id));
}

export async function addShop(input: {
  name: string;
  address: string;
  region: string;
  location: Geo | null;
}): Promise<Shop> {
  const shop: Omit<Shop, 'id'> = {
    name: input.name.trim(),
    address: input.address.trim(),
    region: input.region.trim() || 'other',
    location: input.location,
    status: 'active',
    createdAt: new Date().toISOString(),
    ownerUid: readScope()?.uid,
  };
  if (isFirebaseConfigured()) {
    const ref = await addDoc(collection(getAdminDb(), 'branches'), shop);
    return { id: ref.id, ...shop };
  }
  const full: Shop = { id: id('br'), ...shop };
  lsWrite(LS.shops, [...lsRead<Shop>(LS.shops), full]);
  return full;
}

export async function updateShop(id: string, patch: Partial<Shop>): Promise<void> {
  if (isFirebaseConfigured()) {
    await updateDoc(doc(getAdminDb(), 'branches', id), patch);
    return;
  }
  lsWrite(LS.shops, lsRead<Shop>(LS.shops).map((s) => (s.id === id ? { ...s, ...patch } : s)));
}

export async function deleteShop(id: string): Promise<void> {
  if (isFirebaseConfigured()) {
    await deleteDoc(doc(getAdminDb(), 'branches', id));
    return;
  }
  lsWrite(LS.shops, lsRead<Shop>(LS.shops).filter((s) => s.id !== id));
}

/* ======================================================= PRODUCTS */
export async function listProducts(branchId?: string): Promise<Product[]> {
  if (isFirebaseConfigured()) {
    const snap = await getDocs(collection(getAdminDb(), 'products'));
    const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, 'id'>) }));
    if (branchId) return all.filter((p) => p.branchId === branchId);
    return scopeFilterProducts(all);
  }
  const all = lsRead<Product>(LS.products);
  if (branchId) return all.filter((p) => p.branchId === branchId);
  return scopeFilterProducts(all);
}

/** Weka filter ya bidhaa kwa maduka ya admin aliyeingia. */
async function scopeFilterProducts(all: Product[]): Promise<Product[]> {
  const ids = await scopedShopIds();
  if (!ids) return all;
  return all.filter((p) => ids.has(p.branchId));
}

/** Ongeza bidhaa nyingi kwa mara moja (kila moja na bei yake). */
export async function addProducts(branchId: string, items: { name: string; price: number }[]): Promise<void> {
  const clean = items
    .map((i) => ({ name: i.name.trim(), price: Number(i.price) || 0 }))
    .filter((i) => i.name.length > 0);
  if (clean.length === 0) return;

  if (isFirebaseConfigured()) {
    const col = collection(getAdminDb(), 'products');
    const payload = (i: { name: string; price: number }) => ({
      branchId,
      name: i.name,
      price: i.price,
      createdAt: new Date().toISOString(),
    });
    await Promise.all(
      clean.map(async (i) => {
        await addDoc(col, payload(i));
      })
    );
    return;
  }
  const nowProducts = lsRead<Product>(LS.products);
  const added: Product[] = clean.map((i) => ({
    id: id('pr'),
    branchId,
    name: i.name,
    price: i.price,
    createdAt: new Date().toISOString(),
  }));
  lsWrite(LS.products, [...nowProducts, ...added]);
}

export async function deleteProduct(id: string): Promise<void> {
  if (isFirebaseConfigured()) {
    await deleteDoc(doc(getAdminDb(), 'products', id));
    return;
  }
  lsWrite(LS.products, lsRead<Product>(LS.products).filter((p) => p.id !== id));
}

/** Rekebisha bidhaa (bei/jina) — mara moja inaonekana kwenye app. */
export async function updateProduct(
  id: string,
  patch: Partial<Pick<Product, 'name' | 'price'>>
): Promise<void> {
  if (isFirebaseConfigured()) {
    await updateDoc(doc(getAdminDb(), 'products', id), patch);
    return;
  }
  lsWrite(LS.products, lsRead<Product>(LS.products).map((p) => (p.id === id ? { ...p, ...patch } : p)));
}

/* ================================================== CLOSING REPORTS */
/** Safu ya UTC kuongeza siku — kwa ukokotoaji wa tarehe ya kesho. */
function addDays(date: string, n: number): string {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function mapClosingReport(id: string, data: Record<string, unknown>): ClosingReport {
  const items = Array.isArray(data.items)
    ? (data.items as Record<string, unknown>[]).map((r) => {
        const current = Number(r.current ?? r.qty ?? 0);
        const price = Number(r.price ?? 0);
        const remaining = Number(r.remaining ?? r.qty ?? 0);
        const sold = current - remaining;
        return {
          name: String(r.name ?? ''),
          current,
          price,
          remaining,
          sold: sold >= 0 ? sold : 0,
          revenue: sold >= 0 ? sold * price : 0,
        };
      })
    : [];
  const totalRevenue = items.reduce((s, i) => s + i.revenue, 0);
  return {
    id,
    shopId: String(data.shopId ?? ''),
    shopName: String(data.shopName ?? ''),
    date: String(data.date ?? ''),
    items,
    totalRevenue: Number(data.totalRevenue ?? totalRevenue),
    status: data.status === 'approved' ? 'approved' : 'pending_admin',
    managerName: data.managerName ? String(data.managerName) : undefined,
    submittedAt: data.submittedAt ? String(data.submittedAt) : undefined,
    approvedAt: data.approvedAt ? String(data.approvedAt) : undefined,
  };
}

export async function listClosingReports(): Promise<ClosingReport[]> {
  if (!isFirebaseConfigured()) return [];
  const snap = await getDocs(collection(getAdminDb(), COLLECTIONS.closingReports));
  let all = snap.docs.map((d) => mapClosingReport(d.id, d.data() as Record<string, unknown>));
  const ids = await scopedShopIds();
  if (ids) all = all.filter((c) => ids.has(c.shopId));
  return all;
}

/** Chukua closing report moja kwa id (`${shopId}_${date}`). */
export async function getClosingReport(id: string): Promise<ClosingReport | null> {
  if (!isFirebaseConfigured()) return null;
  const ref = doc(getAdminDb(), COLLECTIONS.closingReports, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return mapClosingReport(snap.id, snap.data() as Record<string, unknown>);
}

/** Admin anapokea/kuidhinisha Closing Stock ya msimamizi. Mara moja huwa
 *  inazalisha OPENING + CURRENT STOCK ya kesho (`{opening,current}Stocks/{shopId}_${kesho}`)
 *  kwa items zilizobaki (remaining) — hivyo app usubuhi itajipakia yenyewe. */
export async function approveClosing(id: string): Promise<{ ok: boolean; message?: string }> {
  if (!isFirebaseConfigured()) return { ok: false, message: 'Firebase not configured.' };
  const ref = doc(getAdminDb(), COLLECTIONS.closingReports, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { ok: false, message: 'Closing report not found.' };
  const data = snap.data() as Record<string, unknown>;
  if (data.status === 'approved') return { ok: true };

  const closing = mapClosingReport(id, data);
  const nextDate = addDays(closing.date, 1);

  // REFERENCE = CURRENT STOCK ya siku iliyofungwa (admin ndiye aiendelee kuihifadhi:
  //  ameongeza bidhaa mchana 4->10, ameondoa bidhaa, n.k.). Hizo ndizo kwa kesho.
  //  Kwa bidhaa zilizoonekana kwenye closing report, kiasi kinachukuliwa kuwa ni
  //  REMAINING (idiadi halisi iliyobaki mkononi); bidhaa ambazo admin aliongeza
  //  baada ya closing kutuma zinabaki kwa idadi yao ya current.
  const currentRef = doc(getAdminDb(), COLLECTIONS.currentStocks, `${closing.shopId}_${closing.date}`);
  const currentSnap = await getDoc(currentRef);
  const currentArr = currentSnap.exists()
    ? ((currentSnap.data() as Record<string, unknown>).items as Record<string, unknown>[] | undefined) ?? []
    : [];

  let nextItems: CurrentStockItem[];
  if (currentArr.length > 0) {
    const byNameFromClosing = new Map<string, number>();
    for (const it of closing.items) byNameFromClosing.set(it.name, it.remaining);
    nextItems = currentArr
      .map((r) => {
        const name = String(r.name ?? '');
        const qty = byNameFromClosing.has(name)
          ? Math.max(0, Number(byNameFromClosing.get(name)) || 0)
          : Number(r.qty ?? 0);
        return { name, qty, price: Number(r.price ?? 0) };
      })
      .filter((it) => it.qty > 0);
    if (nextItems.length === 0) {
      nextItems = closing.items
        .filter((it) => it.remaining > 0)
        .map((it) => ({ name: it.name, qty: it.remaining, price: it.price }));
    }
  } else {
    nextItems = closing.items
      .filter((it) => it.remaining > 0)
      .map((it) => ({ name: it.name, qty: it.remaining, price: it.price }));
  }
  const total = nextItems.reduce((s, i) => s + i.qty * i.price, 0);

  // Andika docs zote KABLA ya kuweka status approved — kama hii itashindikana
  // hali inabaki 'pending_admin' na admin anaweza kurudia tena (setDoc ni idempotent).
  const openingPayload = {
    shopId: closing.shopId,
    shopName: closing.shopName,
    date: nextDate,
    items: nextItems,
    total,
    status: 'generated',
    sourceClosingId: id,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(getAdminDb(), COLLECTIONS.openingStocks, `${closing.shopId}_${nextDate}`), openingPayload);
  // Current Stock ya kesho = sawa na opening kwa mwanzo (admin ataiweza).
  await setDoc(
    doc(getAdminDb(), COLLECTIONS.currentStocks, `${closing.shopId}_${nextDate}`),
    {
      shopId: closing.shopId,
      shopName: closing.shopName,
      date: nextDate,
      items: nextItems,
      createdAt: new Date().toISOString(),
    },
    { merge: true }
  );
  // Kumbuka: SISI HATUANDIKI tena current ya LEO (siku iliyofungwa) kuwa 'remaining'.
  //  Ukweli wetu: opening_leo == current_leo daima; remaining inakwenda tu kwa kesho.
  await updateDoc(ref, { status: 'approved', approvedAt: new Date().toISOString() });
  return { ok: true };
}

export async function listConfirmedOpenings(): Promise<OpeningStockDoc[]> {
  if (!isFirebaseConfigured()) return [];
  const snap = await getDocs(collection(getAdminDb(), COLLECTIONS.openingStocks));
  const out: OpeningStockDoc[] = [];
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>;
    const status = String(data.status ?? '');
    const confirmedAt = data.confirmedAt ? String(data.confirmedAt) : '';
    if (status !== 'confirmed' || !confirmedAt) continue;
    out.push({
      id: d.id,
      shopId: String(data.shopId ?? ''),
      shopName: String(data.shopName ?? ''),
      date: String(data.date ?? ''),
      items: Array.isArray(data.items)
        ? (data.items as Record<string, unknown>[]).map((r) => ({
            name: String(r.name ?? ''),
            qty: Number(r.qty ?? 0),
            price: Number(r.price ?? 0),
          }))
        : [],
      total: Number(data.total ?? 0),
      status: 'confirmed',
      sourceClosingId: data.sourceClosingId ? String(data.sourceClosingId) : undefined,
      confirmedAt,
      managerConfirmedByName: data.managerConfirmedByName ? String(data.managerConfirmedByName) : undefined,
    });
  }
  const ids = await scopedShopIds();
  if (ids) return out.filter((o) => ids.has(o.shopId)).sort((a, b) => (b.confirmedAt ?? '').localeCompare(a.confirmedAt ?? ''));
  return out.sort((a, b) => (b.confirmedAt ?? '').localeCompare(a.confirmedAt ?? ''));
}

/* ==================================================== CURRENT STOCK */
function mapCurrentStock(id: string, data: Record<string, unknown>): CurrentStock {
  const items = Array.isArray(data.items)
    ? (data.items as Record<string, unknown>[]).map((r) => ({
        name: String(r.name ?? ''),
        qty: Number(r.qty ?? 0),
        price: Number(r.price ?? 0),
      }))
    : [];
  return {
    id,
    shopId: String(data.shopId ?? ''),
    shopName: String(data.shopName ?? ''),
    date: String(data.date ?? ''),
    items,
    createdAt: data.createdAt ? String(data.createdAt) : undefined,
  };
}

/** Current Stock ya duka kwa tarehe fulani (default: leo).
 *  Current Stock ndio CHANZO CHA UKWELI PEKEE ya Daily Closing — closing inasoma
 *  hiyo, na approval inai-sync kila siku (= remaining). Hakuna fallback kwenye
 *  opening. Ikiwa current ya tarehe iliyoulizwa haipo, tunarudisha session ya
 *  MWISHO iliyokuwepo (duka linaweza kufunguliwa/kufungwa > mara 2 kwa siku,
 *  hivyo "current iliyopo sasa" ndiyo muhimu, si ile ya tarehe ya kalenda). */
export async function getCurrentStock(
  shopId: string,
  date: string
): Promise<CurrentStock | null> {
  if (!isFirebaseConfigured()) return null;
  const ref = doc(getAdminDb(), COLLECTIONS.currentStocks, `${shopId}_${date}`);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const s = mapCurrentStock(snap.id, snap.data() as Record<string, unknown>);
    return { id: s.id, shopId, shopName: s.shopName, date: s.date, items: s.items, createdAt: s.createdAt };
  }
  const latest = await getLatestCurrentStock(shopId);
  return latest;
}

/** Doc ya "current" ya session ya mwisho kwa duka (kwa `date` desc). */
export async function getLatestCurrentStock(shopId: string): Promise<CurrentStock | null> {
  if (!isFirebaseConfigured()) return null;
  const q = query(collection(getAdminDb(), COLLECTIONS.currentStocks), where('shopId', '==', shopId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docs = snap.docs
    .map((d) => mapCurrentStock(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => b.date.localeCompare(a.date));
  return docs[0] ?? null;
}

/** Tarehe ya session ya sasa kupelekwa kwenye current/opening (fallback = leo). */
export async function resolveActiveStockDate(shopId: string, fallback: string): Promise<string> {
  const latest = await getLatestCurrentStock(shopId);
  return latest?.date ?? fallback;
}

/** Hifadhi Current Stock (msimamizi wa admin ndiye hataweka bidhaa/idiadi
 *  katikati ya siku). Hutumia `setDoc` (write-through) kwa array nzima. */
export async function saveCurrentStock(
  shopId: string,
  shopName: string,
  date: string,
  items: CurrentStockItem[]
): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const existing = await getCurrentStock(shopId, date);
  await setDoc(
    doc(getAdminDb(), COLLECTIONS.currentStocks, `${shopId}_${date}`),
    {
      shopId,
      shopName,
      date,
      items,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    },
    { merge: true }
  );

  // Mirror kwenye opening — kanuni: opening == current daima, kwa hivyo
  // bidhaa/idiadi zozote zinazobadilishwa katikati ya siku zisibu mpishano.
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);
  await setDoc(
    doc(getAdminDb(), COLLECTIONS.openingStocks, `${shopId}_${date}`),
    { shopId, shopName, date, items, total },
    { merge: true }
  );
}

/* ========================================================== SALES */
export async function listSales(): Promise<SaleTx[]> {
  let all: SaleTx[];
  if (isFirebaseConfigured()) {
    const snap = await getDocs(collection(getAdminDb(), 'transactions'));
    all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SaleTx, 'id'>) }));
  } else {
    all = lsRead<SaleTx>(LS.transactions);
  }
  const ids = await scopedShopIds();
  if (ids) return all.filter((t) => ids.has(t.branchId));
  return all;
}

/* ================================================= REGISTRATIONS */
export async function listRegistrations(): Promise<ManagerRegistration[]> {
  let all: ManagerRegistration[];
  if (isFirebaseConfigured()) {
    const snap = await getDocs(collection(getAdminDb(), 'pendingRegistrations'));
    all = snap.docs.map((d) => ({ userId: d.id, ...(d.data() as Omit<ManagerRegistration, 'userId'>) }));
  } else {
    all = lsRead<ManagerRegistration>(LS.registrations);
  }
  const ids = await scopedShopIds();
  if (ids) return all.filter((r) => ids.has(r.branchId));
  return all;
}

export async function updateRegistration(id: string, status: ManagerRegistration['status']) {
  if (isFirebaseConfigured()) {
    await updateDoc(doc(getAdminDb(), 'pendingRegistrations', id), { status });
    return;
  }
  lsWrite(LS.registrations, lsRead<ManagerRegistration>(LS.registrations).map((r) => (r.userId === id ? { ...r, status } : r)));
}

/** Futa usajili kabisa (kwa mf.: msimamizi jibwe kwa makosa, au ajeze
 *  kusajili upya). App hiyo itaonyesha "Usajili haujapatikana" → huanza upya. */
export async function deleteRegistration(id: string) {
  if (isFirebaseConfigured()) {
    await deleteDoc(doc(getAdminDb(), 'pendingRegistrations', id));
    return;
  }
  lsWrite(LS.registrations, lsRead<ManagerRegistration>(LS.registrations).filter((r) => r.userId !== id));
}

/* ============================================== REAL-TIME & HELPERS */
/** Subscription ya mabadiliko:
 *  - localStorage mode: 'neo-db-changed' + 'storage' + visibilitychange
 *  - Firebase mode: onSnapshot ya collections zote → page inafanya load() toka mtu
 *    (au app) abadilishe data, up-to-date tena bila kubandika page. */
export function subscribe(cb: () => void): () => void {
  const unsubs: (() => void)[] = [];
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('neo-db-changed', cb);
  window.addEventListener('storage', cb);
  document.addEventListener('visibilitychange', cb);

  if (isFirebaseConfigured()) {
    for (const col of [
      COLLECTIONS.branches,
      COLLECTIONS.products,
      COLLECTIONS.transactions,
      COLLECTIONS.pendingRegistrations,
      COLLECTIONS.closingReports,
      COLLECTIONS.openingStocks,
      COLLECTIONS.currentStocks,
      COLLECTIONS.cashReconciliations,
      COLLECTIONS.stockReceiving,
      COLLECTIONS.stockRequests,
      COLLECTIONS.expenses,
    ]) {
      unsubs.push(onSnapshot(collection(getAdminDb(), col), () => cb()));
    }
  }

  return () => {
    window.removeEventListener('neo-db-changed', cb);
    window.removeEventListener('storage', cb);
    document.removeEventListener('visibilitychange', cb);
    unsubs.forEach((u) => u());
  };
}

/** Bidhaa kwa kiwango cha mauzo (quantity) — kwa graph ya "zinazouzwa zaidi". */
export type TopProduct = { name: string; quantity: number; revenue: number };
export function topSelling(sales: SaleTx[], limit = 8): TopProduct[] {
  const map = new Map<string, TopProduct>();
  for (const s of sales) {
    const cur = map.get(s.productName) ?? { name: s.productName, quantity: 0, revenue: 0 };
    cur.quantity += s.quantity;
    cur.revenue += s.totalPrice;
    map.set(s.productName, cur);
  }
  return [...map.values()].sort((a, b) => b.quantity - a.quantity).slice(0, limit).filter((t) => t.quantity > 0);
}

export { formatTsh };

/* ================================================== CASH RECONCILIATION */
export type CashReconciliationRow = {
  id: string;
  shopId: string;
  shopName: string;
  date: string;
  openingCash: number;
  openingCashSource?: string;
  openingStockValue: number;
  salesRevenue: number;
  cashIn: number;
  cashOut: number;
  expensesTotal: number;
  receivingTotal: number;
  requestTotal: number;
  moneyOut: number;
  adminAdjustment?: number;
  expectedCash: number;
  countedCash: number;
  variance: number;
  varianceKind: 'matched' | 'shortage' | 'overage';
  note?: string;
  managerName?: string;
  status: 'pending_admin' | 'approved';
  submittedAt?: string;
};

function mapCashReconciliation(id: string, data: Record<string, unknown>): CashReconciliationRow {
  const adminAdjustment = data.adminAdjustment == null ? undefined : Number(data.adminAdjustment);
  const storedExpected = Number(data.expectedCash ?? 0);
  const expectedCash = storedExpected + (adminAdjustment ?? 0);
  const countedCash = Number(data.countedCash ?? 0);
  const variance = countedCash - expectedCash;
  return {
    id,
    shopId: String(data.shopId ?? ''),
    shopName: String(data.shopName ?? ''),
    date: String(data.date ?? ''),
    openingCash: Number(data.openingCash ?? 0),
    openingCashSource: data.openingCashSource ? String(data.openingCashSource) : undefined,
    openingStockValue: Number(data.openingStockValue ?? 0),
    salesRevenue: Number(data.salesRevenue ?? 0),
    cashIn: Number(data.cashIn ?? 0),
    cashOut: Number(data.cashOut ?? 0),
    expensesTotal: Number(data.expensesTotal ?? 0),
    receivingTotal: Number(data.receivingTotal ?? 0),
    requestTotal: Number(data.requestTotal ?? 0),
    moneyOut: Number(data.moneyOut ?? 0),
    adminAdjustment,
    expectedCash,
    countedCash,
    variance,
    varianceKind: variance === 0 ? 'matched' : variance < 0 ? 'shortage' : 'overage',
    note: data.note ? String(data.note) : undefined,
    managerName: data.managerName ? String(data.managerName) : undefined,
    status: data.status === 'approved' ? 'approved' : 'pending_admin',
    submittedAt: data.submittedAt ? String(data.submittedAt) : undefined,
  };
}

export async function listCashReconciliations(): Promise<CashReconciliationRow[]> {
  if (!isFirebaseConfigured()) return [];
  const snap = await getDocs(collection(getAdminDb(), COLLECTIONS.cashReconciliations));
  let all = snap.docs.map((d) => mapCashReconciliation(d.id, d.data() as Record<string, unknown>));
  const ids = await scopedShopIds();
  if (ids) all = all.filter((r) => ids.has(r.shopId));
  return all;
}

/** Admin anaapprove Cash Reconciliation; `adjustment` (TSh) inaongeza/kutoa kwa opening
 *  na inabadilisha variance (namba chanya = kuongeza, hasi = kutoa). */
export async function approveCashReconciliation(id: string, adjustment?: number): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const ref = doc(getAdminDb(), COLLECTIONS.cashReconciliations, id);
  const fields: Record<string, unknown> = {
    status: 'approved',
    approvedAt: new Date().toISOString(),
  };
  if (typeof adjustment === 'number' && !Number.isNaN(adjustment) && adjustment !== 0) {
    const data = (await getDoc(ref)).data() as Record<string, unknown> | undefined;
    const expectedCash = Number(data?.expectedCash ?? 0);
    const countedCash = Number(data?.countedCash ?? 0);
    fields.adminAdjustment = adjustment;
    fields.variance = countedCash - (expectedCash + adjustment);
  }
  await updateDoc(ref, fields);
}

/** Count pending (un-approved) cash reconciliations. */
export async function countPendingCashReconciliations(): Promise<number> {
  if (!isFirebaseConfigured()) return 0;
  const snap = await getDocs(
    query(collection(getAdminDb(), COLLECTIONS.cashReconciliations), where('status', '==', 'pending_admin'))
  );
  return snap.size;
}

/* ============================================== STOCK RECEIVING */
export type StockReceivingRow = {
  id: string;
  shopId: string;
  shopName: string;
  date: string;
  items: { name: string; price: number; qty: number }[];
  total: number;
  status: 'pending_admin' | 'approved';
  managerName?: string;
  note?: string;
  submittedAt?: string;
};

export type StockRequestRow = StockReceivingRow & {
  reason?: string;
};

export type ExpenseRow = {
  id: string;
  shopId: string;
  shopName: string;
  date: string;
  items: { description: string; amount: number; category?: string }[];
  total: number;
  status: 'pending_admin' | 'approved';
  managerName?: string;
  submittedAt?: string;
};

function mapTxItems(raw: unknown): { name: string; price: number; qty: number }[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((it) => ({
    name: String(it.name ?? ''),
    price: Number(it.price ?? 0),
    qty: Number(it.qty ?? 0),
  }));
}

function mapExpenseItems(raw: unknown): ExpenseRow['items'] {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((it) => ({
    description: String(it.description ?? ''),
    amount: Number(it.amount ?? 0),
    category: it.category ? String(it.category) : undefined,
  }));
}

export async function listStockReceiving(): Promise<StockReceivingRow[]> {
  if (!isFirebaseConfigured()) return [];
  const snap = await getDocs(collection(getAdminDb(), COLLECTIONS.stockReceiving));
  let all: StockReceivingRow[] = snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    const items = mapTxItems(data.items);
    return {
      id: d.id,
      shopId: String(data.shopId ?? ''),
      shopName: String(data.shopName ?? ''),
      date: String(data.date ?? ''),
      items,
      total: Number(data.total ?? items.reduce((s, i) => s + i.price * i.qty, 0)),
      status: data.status === 'approved' ? 'approved' : 'pending_admin',
      managerName: data.managerName ? String(data.managerName) : undefined,
      note: data.note ? String(data.note) : undefined,
      submittedAt: data.submittedAt ? String(data.submittedAt) : undefined,
    };
  });
  const ids = await scopedShopIds();
  if (ids) all = all.filter((r) => ids.has(r.shopId));
  return all;
}

export async function listStockRequests(): Promise<StockRequestRow[]> {
  if (!isFirebaseConfigured()) return [];
  const snap = await getDocs(collection(getAdminDb(), COLLECTIONS.stockRequests));
  let all: StockRequestRow[] = snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    const items = mapTxItems(data.items);
    return {
      id: d.id,
      shopId: String(data.shopId ?? ''),
      shopName: String(data.shopName ?? ''),
      date: String(data.date ?? ''),
      items,
      total: Number(data.total ?? items.reduce((s, i) => s + i.price * i.qty, 0)),
      status: data.status === 'approved' ? 'approved' : 'pending_admin',
      managerName: data.managerName ? String(data.managerName) : undefined,
      reason: data.reason ? String(data.reason) : undefined,
      submittedAt: data.submittedAt ? String(data.submittedAt) : undefined,
    };
  });
  const ids = await scopedShopIds();
  if (ids) all = all.filter((r) => ids.has(r.shopId));
  return all;
}

export async function listExpenses(): Promise<ExpenseRow[]> {
  if (!isFirebaseConfigured()) return [];
  const snap = await getDocs(collection(getAdminDb(), COLLECTIONS.expenses));
  let all: ExpenseRow[] = snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    const items = mapExpenseItems(data.items);
    return {
      id: d.id,
      shopId: String(data.shopId ?? ''),
      shopName: String(data.shopName ?? ''),
      date: String(data.date ?? ''),
      items,
      total: Number(data.total ?? items.reduce((s, i) => s + i.amount, 0)),
      status: data.status === 'approved' ? 'approved' : 'pending_admin',
      managerName: data.managerName ? String(data.managerName) : undefined,
      submittedAt: data.submittedAt ? String(data.submittedAt) : undefined,
    };
  });
  const ids = await scopedShopIds();
  if (ids) all = all.filter((r) => ids.has(r.shopId));
  return all;
}

/** Admin anaapprove Stock Receiving → bidhaa zilizopokelewa zinaongezwa kwenye
 *  current stock ya siku ya kupokea (merge kwa jina la bidhaa, price kutoka receiving). */
export async function approveStockReceiving(id: string): Promise<{ ok: boolean; message?: string }> {
  if (!isFirebaseConfigured()) return { ok: false, message: 'Firebase not configured.' };
  const ref = doc(getAdminDb(), COLLECTIONS.stockReceiving, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { ok: false, message: 'Receiving record not found.' };
  const data = snap.data() as Record<string, unknown>;
  if (data.status === 'approved') return { ok: true };
  const shopId = String(data.shopId ?? '');
  const shopName = String(data.shopName ?? '');
  const date = String(data.date ?? '');
  const items = mapTxItems(data.items);

  await updateDoc(ref, { status: 'approved', approvedAt: new Date().toISOString() });

  // Merge into current stock ya session ILIYOPO SASA (si lazima iwe tarehe ya
  // leo — duka linaweza kufunguliwa/kufungwa mara nyingi kwa siku). Hii
  // inahakikisha bidhaa zilizopokelewa zinaonekana mara moja kwenye current
  // ya app (ambayo inasoma session ya mwisho) na kwenye closing.
  const active = await getLatestCurrentStock(shopId);
  const targetDate = active ? active.date : date;
  const stockRef = doc(getAdminDb(), COLLECTIONS.currentStocks, `${shopId}_${targetDate}`);
  const stockSnap = await getDoc(stockRef);
  const existing = stockSnap.exists()
    ? (stockSnap.data() as Record<string, unknown>).items
    : [];
  const existingArr: { name: string; qty: number; price: number }[] = Array.isArray(existing)
    ? (existing as Record<string, unknown>[]).map((i) => ({
        name: String(i.name ?? ''),
        qty: Number(i.qty ?? 0),
        price: Number(i.price ?? 0),
      }))
    : [];

  const byName = new Map<string, { name: string; qty: number; price: number }>();
  for (const it of existingArr) byName.set(it.name, it);
  for (const it of items) {
    const prev = byName.get(it.name);
    byName.set(it.name, { name: it.name, qty: (prev?.qty ?? 0) + it.qty, price: prev?.price ?? it.price });
  }
  const merged = [...byName.values()];
  const mergedTotal = merged.reduce((s, i) => s + i.qty * i.price, 0);

  await setDoc(
    stockRef,
    { shopId, shopName, date: targetDate, items: merged, createdAt: new Date().toISOString() },
    { merge: true }
  );

  // Weka sawa pia kwenye OPENING ya session ile ile — kanuni yetu: opening == current
  // daima, hivyo bidhaa zilizopokelewa zionekane kwenye closing (current) NA
  // zisibu mpishano na opening.
  const openingRef = doc(getAdminDb(), COLLECTIONS.openingStocks, `${shopId}_${targetDate}`);
  const openingSnap = await getDoc(openingRef);
  if (openingSnap.exists() || items.length > 0) {
    await setDoc(
      openingRef,
      { shopId, shopName, date: targetDate, items: merged, total: mergedTotal },
      { merge: true }
    );
  }
  return { ok: true };
}

/** Admin anathibitisha Stock Request (approved = itatengenezwa/kuwasilishwa). */
export async function approveStockRequest(id: string): Promise<{ ok: boolean; message?: string }> {
  if (!isFirebaseConfigured()) return { ok: false, message: 'Firebase not configured.' };
  const ref = doc(getAdminDb(), COLLECTIONS.stockRequests, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { ok: false, message: 'Request not found.' };
  if ((snap.data() as Record<string, unknown>).status === 'approved') return { ok: true };
  await updateDoc(ref, { status: 'approved', approvedAt: new Date().toISOString() });
  return { ok: true };
}

/** Admin anaapprove Expenses. */
export async function approveExpense(id: string): Promise<{ ok: boolean; message?: string }> {
  if (!isFirebaseConfigured()) return { ok: false, message: 'Firebase not configured.' };
  const ref = doc(getAdminDb(), COLLECTIONS.expenses, id);
  await updateDoc(ref, { status: 'approved', approvedAt: new Date().toISOString() });
  return { ok: true };
}

/* ===================================================== SHOP CHANGE (wasimamizi)
 * Msimamizi anatumia app kujaza ombi (from/to/name). Admin anauidhinisha →
 * registration ya msimamizi inahamia duka la mpya (developer): app hiyo
 * ichwaanapo kita-approved, msimamizi anahamia duka la mpya moja kwa moja. */

export type ShopChangeRow = {
  id: string;
  userId: string;
  managerName: string;
  shopFromId: string;
  shopFromName: string;
  shopToId: string;
  shopToName: string;
  status: 'pending_admin' | 'approved' | 'rejected';
  submittedAt?: string;
  approvedAt?: string;
};

export async function listShopChangeRequests(): Promise<ShopChangeRow[]> {
  if (!isFirebaseConfigured()) return [];
  const snap = await getDocs(collection(getAdminDb(), COLLECTIONS.shopChangeRequests));
  let all: ShopChangeRow[] = snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    const status = String(data.status ?? '');
    return {
      id: d.id,
      userId: String(data.userId ?? ''),
      managerName: String(data.managerName ?? ''),
      shopFromId: String(data.shopFromId ?? ''),
      shopFromName: String(data.shopFromName ?? ''),
      shopToId: String(data.shopToId ?? ''),
      shopToName: String(data.shopToName ?? ''),
      status: (status === 'approved' || status === 'rejected' ? status : 'pending_admin') as ShopChangeRow['status'],
      submittedAt: data.submittedAt ? String(data.submittedAt) : undefined,
      approvedAt: data.approvedAt ? String(data.approvedAt) : undefined,
    };
  });
  const ids = await scopedShopIds();
  if (ids) all = all.filter((r) => ids.has(r.shopFromId) || ids.has(r.shopToId));
  return all;
}

/** Admin anaidhinisha msimamizi ahamie duka jingine:
 *  - anasasisha registration ya msimamizi (pendingRegistrations/{userId})
 *    → branchId/branchName va duka la mpya;
 *  - anabandika status 'approved' kwenye ombi → app inatembea papo hapo. */
export async function approveShopChange(id: string): Promise<{ ok: boolean; message?: string }> {
  if (!isFirebaseConfigured()) return { ok: false, message: 'Firebase not configured.' };
  const ref = doc(getAdminDb(), COLLECTIONS.shopChangeRequests, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { ok: false, message: 'Request not found.' };
  const data = snap.data() as Record<string, unknown>;
  if (data.status === 'approved') return { ok: true };

  const userId = String(data.userId ?? '');
  const shopToId = String(data.shopToId ?? '');
  const shopToName = String(data.shopToName ?? '');
  const shopFromId = String(data.shopFromId ?? '');

  if (userId && shopToId) {
    const regRef = doc(getAdminDb(), COLLECTIONS.pendingRegistrations, userId);
    const regSnap = await getDoc(regRef);
    if (regSnap.exists()) {
      const reg = regSnap.data() as Record<string, unknown>;
      const toShop = shopToId;
      const toShopSnap = await getDoc(doc(getAdminDb(), COLLECTIONS.branches, toShop));
      const toData = toShopSnap.exists() ? (toShopSnap.data() as Record<string, unknown>) : {};
      await updateDoc(regRef, {
        branchId: shopToId,
        branchName: shopToName,
        branchRegion: String(toData.region ?? reg.branchRegion ?? ''),
        branchAddress: String(toData.address ?? reg.branchAddress ?? ''),
        movedFromId: shopFromId,
        movedAt: new Date().toISOString(),
      });
    }
  }

  await updateDoc(ref, { status: 'approved', approvedAt: new Date().toISOString() });
  return { ok: true };
}

/** Total ya pending transactions zote (receiving + requests + expenses + shop change). */
export async function countPendingTransactions(): Promise<number> {
  if (!isFirebaseConfigured()) return 0;
  const [r, q, e, s] = await Promise.all([
    getDocs(query(collection(getAdminDb(), COLLECTIONS.stockReceiving), where('status', '==', 'pending_admin'))),
    getDocs(query(collection(getAdminDb(), COLLECTIONS.stockRequests), where('status', '==', 'pending_admin'))),
    getDocs(query(collection(getAdminDb(), COLLECTIONS.expenses), where('status', '==', 'pending_admin'))),
    getDocs(query(collection(getAdminDb(), COLLECTIONS.shopChangeRequests), where('status', '==', 'pending_admin'))),
  ]);
  return r.size + q.size + e.size + s.size;
}