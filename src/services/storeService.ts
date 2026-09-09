/**
 * Huduma ya maduka (stores) na usajili wa msimamizi (onboarding).
 *
 * Muundo (upande wa APP — usajili nyepesi, hakuna login):
 *  - `getAvailableBranches()`  → list ya maduka yaliyopangwa NA admin
 *    (hapo ndipo "controlled list" — msimamizi HASHIDEKI hatakiwi kuandika jina).
 *  - `registerManager()`       → inawekwa kwenye Firestore `pendingRegistrations`
 *    (status: 'pending') ili admin web aweze kuona na kuidhinisha.
 *
 * Wakati USE_FIREBASE=false, maagizo ya mock (hapo chini) yanatumika.
 * Wakati Firebase iko (USE_FIREBASE=true), Firestore ndio chanzo.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { mockBranches } from '../data/branches';
import { regionLabel } from '../data/regions';
import {
  COLLECTIONS,
  getDB,
  isFirebaseConfigured,
} from './firebase';
import type {
  AdminInfo,
  Branch,
  CashReconciliation,
  ClosingItem,
  ClosingStock,
  CurrentStock,
  CurrentStockItem,
  ExpenseItem,
  ExpenseSubmission,
  ManagerProfile,
  OnboardingResult,
  OpeningStock,
  RegistrationStatus,
  StockItem,
  StockReceiving,
  StockReceivingItem,
  StockRequest,
  StockRequestItem,
} from './types';

const PROFILE_KEY = 'neosmartcore.managerProfile';

/** Siku ya leo kwa format `YYYY-MM-DD` (kwa jina la doc za stock). */
export function todayDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function makeId(prefix: string): string {
  return (
    prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
  );
}

/** Geuza doc mbichi ya Firestore `branches` iwe Branch (kwa format ya admin web). */
function mapBranchDoc(id: string, data: Record<string, unknown>): Branch {
  return {
    id,
    name: String(data.name ?? 'Duka'),
    region: String(data.region ?? 'other'),
    address: String(data.address ?? ''),
    location:
      typeof data.location === 'string'
        ? data.location
        : data.location && typeof data.location === 'object'
          ? (data.location as Branch['location'])
          : null,
    status: data.status === 'inactive' ? 'inactive' : 'active',
    createdAt: String(data.createdAt ?? new Date().toISOString()),
    ownerUid: data.ownerUid ? String(data.ownerUid) : undefined,
  };
}

/** Maduka yanayoweza kuchaguliwa wakati wa usajili (yalivyopangwa na admin).
 *  `ownerUid` ikitolewa → maduka ya Admin huyo pekee. */
export async function getAvailableBranches(
  ownerUid?: string
): Promise<Branch[]> {
  if (isFirebaseConfigured()) {
    let q = query(
      collection(getDB(), COLLECTIONS.branches),
      where('status', '==', 'active')
    );
    if (ownerUid) {
      q = query(q, where('ownerUid', '==', ownerUid));
    }
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapBranchDoc(d.id, d.data() as Record<string, unknown>));
  }
  return mockBranches.filter((b) => b.status === 'active');
}

/** Maduka ya kweli-time: panua list kila admin aki-ongeza duka.
 *  `ownerUid` ikitolewa → maduka ya Admin huyo pekee. */
export function subscribeBranches(
  ownerUid: string | undefined,
  onData: (branches: Branch[]) => void,
  onError?: (err: unknown) => void
): () => void {
  if (!isFirebaseConfigured()) {
    getAvailableBranches(ownerUid).then(onData).catch(onError);
    return () => {};
  }
  let q = query(
    collection(getDB(), COLLECTIONS.branches),
    where('status', '==', 'active')
  );
  if (ownerUid) {
    q = query(q, where('ownerUid', '==', ownerUid));
  }
  const unsub = onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => mapBranchDoc(d.id, d.data() as Record<string, unknown>)));
    },
    (err) => onError?.(err)
  );
  return unsub;
}

/* ============================ ADMINS (multi-admin) ============================ */

function mapAdminDoc(id: string, data: Record<string, unknown>): AdminInfo {
  const name = String(data.name ?? '');
  const email = String(data.email ?? '');
  return {
    uid: String(data.uid ?? id),
    name: name || email.split('@')[0] || 'Admin',
    email,
    createdAt: String(data.createdAt ?? ''),
  };
}

/** Orodha ya Admins (wamiliki wa maduka). App inawaonyesha kama
 *  "Admin 1 · <Jina>", "Admin 2 · <Jina>", ... */
export function subscribeAdmins(
  onData: (admins: AdminInfo[]) => void,
  onError?: (err: unknown) => void
): () => void {
  if (!isFirebaseConfigured()) {
    onData([{ uid: 'mock-admin', name: 'Mock Admin', email: 'admin@neo.co.tz' }]);
    return () => {};
  }
  const q = query(collection(getDB(), COLLECTIONS.admins));
  const unsub = onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => mapAdminDoc(d.id, d.data() as Record<string, unknown>)));
    },
    (err) => onError?.(err)
  );
  return unsub;
}

export async function getAdmins(): Promise<AdminInfo[]> {
  if (!isFirebaseConfigured()) {
    return [{ uid: 'mock-admin', name: 'Mock Admin', email: 'admin@neo.co.tz' }];
  }
  const snap = await getDocs(query(collection(getDB(), COLLECTIONS.admins)));
  return snap.docs.map((d) => mapAdminDoc(d.id, d.data() as Record<string, unknown>));
}

export interface ShopProduct {
  id: string;
  branchId: string;
  name: string;
  price: number;
}

/** Bidhaa za duka — zile zilizoweza na admin (admin web) zinajitokeza hapa. */
export async function getProductsForBranch(branchId: string): Promise<ShopProduct[]> {
  if (isFirebaseConfigured()) {
    const q = query(
      collection(getDB(), COLLECTIONS.products),
      where('branchId', '==', branchId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<ShopProduct, 'id'>) }) as ShopProduct
    );
  }
  // Mock: bidhaa za mfano kwa ajili ya kuona mwonekano (preview/offline).
  return mockProductsForBranch(branchId);
}

/** Bidhaa za kweli-time: miengine admin web ibadilishe bei/bidhaa → ikaonekana hapa. */
export function subscribeProducts(
  branchId: string,
  onData: (products: ShopProduct[]) => void,
  onError?: (err: unknown) => void
): () => void {
  if (!isFirebaseConfigured()) {
    getProductsForBranch(branchId).then(onData).catch(onError);
    return () => {};
  }
  const q = query(
    collection(getDB(), COLLECTIONS.products),
    where('branchId', '==', branchId)
  );
  const unsub = onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as Omit<ShopProduct, 'id'>) }) as ShopProduct
        )
      );
    },
    (err) => onError?.(err)
  );
  return unsub;
}

function mockProductsForBranch(branchId: string): ShopProduct[] {
  const seed = ['Mchele', 'Mafuta ya Kupikia', 'Sukari', 'Chumvi', 'Sabuni', 'Karatasi'];
  return seed.map((name, i) => ({
    id: `pr-${branchId}-${i}`,
    branchId,
    name,
    price: 1000 + i * 1500,
  }));
}

/** Hifadhi profile ya msimamizi baada ya kujaza jina, simu na duka. */
export async function registerManager(input: {
  fullName: string;
  phone: string;
  branch: Branch;
  adminUid?: string;
}): Promise<OnboardingResult> {
  const name = input.fullName.trim();
  const phone = input.phone.trim();

  if (name.length < 3) {
    return { ok: false, message: 'Please enter your full name (at least 3 characters).' };
  }
  if (!/^\+?[0-9\s-]{9,15}$/.test(phone)) {
    return {
      ok: false,
      message: 'That phone number is not valid. Use a format like 0712 345 678.',
    };
  }

  if (isFirebaseConfigured()) {
    // Weka kwenye Firestore `pendingRegistrations` — admin anaiona na
    // kuidhinisha. Usisalii data hapa (ihakikishwe na server).
    const payload = {
      fullName: name,
      phone,
      role: 'branch_manager',
      branchId: input.branch.id,
      branchName: input.branch.name,
      branchRegion: input.branch.region ?? 'other',
      branchAddress: input.branch.address ?? '',
      adminUid: input.adminUid ?? input.branch.ownerUid ?? null,
      status: 'pending',
      registeredAt: new Date().toISOString(),
    };
    const ref = await addDoc(collection(getDB(), COLLECTIONS.pendingRegistrations), payload);
    const profile: ManagerProfile = {
      userId: ref.id,
      ...payload,
      status: 'pending',
    } as ManagerProfile;
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return { ok: true, profile };
  }

  // MODE YA MFANO (mock): mara moja inakubaliwa na kuhifadhiwa local.
  const profile: ManagerProfile = {
    userId: makeId('usr'),
    fullName: name,
    phone,
    role: 'branch_manager',
    branchId: input.branch.id,
    branchName: input.branch.name,
    status: 'approved',
    registeredAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return { ok: true, profile };
}

/** Subscriber ya hali ya usajili (pendingRegistrations/{userId}).
 *  Shabaha: admin akiidhinisha → hali inakuwa 'approved' → app inafunguka
 *  moja kwa moja bila msimamizi kufanya kitu. `null` = doc haipo (imefutwa). */
export function subscribeRegistrationStatus(
  userId: string,
  onStatus: (status: RegistrationStatus | null) => void,
  onError?: (err: unknown) => void
): () => void {
  if (!isFirebaseConfigured()) {
    onStatus('approved');
    return () => {};
  }
  const ref = doc(getDB(), COLLECTIONS.pendingRegistrations, userId);
  const unsub = onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onStatus(null);
        return;
      }
      const s = snap.data().status as RegistrationStatus | undefined;
      onStatus(s && ['pending', 'approved', 'rejected'].includes(s) ? s : 'pending');
    },
    (err) => onError?.(err)
  );
  return unsub;
}

/* ============================ OPENING / CLOSING STOCK ============================ */

function mapStockItem(it: unknown): StockItem {
  const row = (it ?? {}) as Record<string, unknown>;
  return {
    name: String(row.name ?? ''),
    qty: Number(row.qty ?? 0),
    price: Number(row.price ?? 0),
    total: Number(row.total ?? Number(row.price ?? 0) * Number(row.qty ?? 0)),
  };
}

function sumStock(items: StockItem[]): number {
  return items.reduce((s, i) => s + i.total, 0);
}

function mapCurrentStockItem(it: unknown): CurrentStockItem {
  const row = (it ?? {}) as Record<string, unknown>;
  return {
    name: String(row.name ?? ''),
    qty: Number(row.qty ?? 0),
    price: Number(row.price ?? 0),
  };
}

function mapOpeningStock(id: string, data: Record<string, unknown>): OpeningStock {
  const items = Array.isArray(data.items)
    ? data.items.map(mapStockItem)
    : [];
  const status =
    data.status === 'confirmed' || data.status === 'sent' ? data.status : 'generated';
  return {
    id,
    shopId: String(data.shopId ?? ''),
    shopName: String(data.shopName ?? ''),
    date: String(data.date ?? todayDateKey()),
    items,
    total: Number(data.total ?? sumStock(items)),
    status,
    sourceClosingId: data.sourceClosingId ? String(data.sourceClosingId) : undefined,
    createdAt: data.createdAt ? String(data.createdAt) : undefined,
    confirmedAt: data.confirmedAt ? String(data.confirmedAt) : undefined,
  };
}

/** Opening Stock kwa duka la msimamizi. `onData(null)` = hakuna bado.
 *  Uchaguzi (ili approval mpya ya admin ionekane mara moja):
 *  1. ya leo ambayo haijathibitishwa;  2. ya karibuni zaidi ambayo bado
 *  haijathibitishwa;  3. ya leo (hata ikiwa confirmed — kwa viewing);
 *  4. fail back: ya karibuni zaidi kabisa. */
export function subscribeOpeningStock(
  branchId: string,
  onData: (opening: OpeningStock | null) => void,
  onError?: (err: unknown) => void,
  dateKey?: string
): () => void {
  if (!isFirebaseConfigured()) {
    onData(null);
    return () => {};
  }
  const col = collection(getDB(), COLLECTIONS.openingStocks);
  const q = query(col, where('shopId', '==', branchId));
  return onSnapshot(
    q,
    (snap) => {
      const today = dateKey ?? todayDateKey();
      const docs = snap.docs
        .map((d) => mapOpeningStock(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.date.localeCompare(a.date));
      const current =
        docs.find((o) => o.date === today && o.status !== 'confirmed') ??
        docs.find((o) => o.status !== 'confirmed') ??
        docs.find((o) => o.date === today) ??
        docs[0];
      onData(current ?? null);
    },
    (err) => onError?.(err)
  );
}

function mapCurrentStock(id: string, data: Record<string, unknown>): CurrentStock {
  const items = Array.isArray(data.items) ? data.items.map(mapCurrentStockItem) : [];
  return {
    id,
    shopId: String(data.shopId ?? ''),
    shopName: String(data.shopName ?? ''),
    date: String(data.date ?? todayDateKey()),
    items,
    createdAt: data.createdAt ? String(data.createdAt) : undefined,
  };
}

/** Current Stock ya leo — admin ndiye anaweza kuiongezea bidhaa/idiadi. */
export function subscribeCurrentStock(
  branchId: string,
  onData: (stock: CurrentStock | null) => void,
  onError?: (err: unknown) => void,
  dateKey?: string
): () => void {
  if (!isFirebaseConfigured()) {
    onData(null);
    return () => {};
  }
  const ref = doc(getDB(), COLLECTIONS.currentStocks, `${branchId}_${dateKey ?? todayDateKey()}`);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(mapCurrentStock(snap.id, snap.data() as Record<string, unknown>));
    },
    (err) => onError?.(err)
  );
}

function mapClosingItem(it: unknown): ClosingItem {
  const row = (it ?? {}) as Record<string, unknown>;
  const current = Number(row.current ?? 0);
  const price = Number(row.price ?? 0);
  const remaining = Number(row.remaining ?? 0);
  const sold = current - remaining;
  return {
    name: String(row.name ?? ''),
    current,
    price,
    remaining,
    sold: sold >= 0 ? sold : 0,
    revenue: Math.max(0, sold) * price,
  };
}

function mapClosingStock(id: string, data: Record<string, unknown>): ClosingStock {
  const items = Array.isArray(data.items) ? data.items.map(mapClosingItem) : [];
  const totalRevenue = items.reduce((s, i) => s + i.revenue, 0);
  return {
    id,
    shopId: String(data.shopId ?? ''),
    shopName: String(data.shopName ?? ''),
    date: String(data.date ?? todayDateKey()),
    items,
    totalRevenue: Number(data.totalRevenue ?? totalRevenue),
    status: data.status === 'approved' ? 'approved' : 'pending_admin',
    managerName: data.managerName ? String(data.managerName) : undefined,
    createdBy: data.createdBy ? String(data.createdBy) : undefined,
    submittedAt: String(data.submittedAt ?? new Date().toISOString()),
    approvedAt: data.approvedAt ? String(data.approvedAt) : undefined,
    expensesConfirmed: data.expensesConfirmed === true,
    moneyOutExpenses: Number(data.moneyOutExpenses ?? 0),
    moneyOutReceiving: Number(data.moneyOutReceiving ?? 0),
    moneyOutRequest: Number(data.moneyOutRequest ?? 0),
    moneyOutTotal: Number(data.moneyOutTotal ?? 0),
  };
}

/** Hali ya Closing Stock ya leo (kwa duka la msimamizi).
 *  `onData(null)` = bado haijaandikwa. */
export function subscribeClosingStock(
  branchId: string,
  onData: (closing: ClosingStock | null) => void,
  onError?: (err: unknown) => void,
  dateKey?: string
): () => void {
  if (!isFirebaseConfigured()) {
    onData(null);
    return () => {};
  }
  const ref = doc(getDB(), COLLECTIONS.closingReports, `${branchId}_${dateKey ?? todayDateKey()}`);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(mapClosingStock(snap.id, snap.data() as Record<string, unknown>));
    },
    (err) => onError?.(err)
  );
}

/** Wasilisha Closing Stock — msimamizi anaandika remaining kwa kila bidhaa;
 *  sold/revenue zinakokotwa automatically kutoka Current Stock. */
export async function submitClosingStock(
  profile: Pick<ManagerProfile, 'branchId' | 'branchName' | 'fullName' | 'userId'>,
  items: { name: string; current: number; price: number; remaining: number }[],
  date?: string,
  money?: {
    expensesConfirmed: boolean;
    expensesTotal: number;
    receivingTotal: number;
    requestTotal: number;
    moneyOut: number;
  }
): Promise<{ ok: boolean; message?: string; docId?: string }> {
  const clean = items
    .map((it) => ({ ...it, name: it.name.trim() }))
    .filter((it) => it.name.length > 0 && it.remaining >= 0);
  if (clean.length === 0) {
    return { ok: false, message: 'Nothing to submit — the stock list is empty.' };
  }
  const closingItems: ClosingItem[] = clean.map((it) => {
    const sold = it.current - it.remaining;
    return {
      name: it.name,
      current: it.current,
      price: it.price,
      remaining: it.remaining,
      sold: sold >= 0 ? sold : 0,
      revenue: Math.max(0, sold) * it.price,
    };
  });
  const totalRevenue = closingItems.reduce((s, i) => s + i.revenue, 0);
  const closeDate = date ?? todayDateKey();
  const payload = {
    shopId: profile.branchId,
    shopName: profile.branchName,
    date: closeDate,
    items: closingItems,
    totalRevenue,
    status: 'pending_admin',
    managerName: profile.fullName,
    createdBy: profile.userId,
    submittedAt: new Date().toISOString(),
    expensesConfirmed: money?.expensesConfirmed === true,
    moneyOutExpenses: money?.expensesTotal ?? 0,
    moneyOutReceiving: money?.receivingTotal ?? 0,
    moneyOutRequest: money?.requestTotal ?? 0,
    moneyOutTotal: money?.moneyOut ?? 0,
  };
  if (isFirebaseConfigured()) {
    const ref = doc(getDB(), COLLECTIONS.closingReports, `${profile.branchId}_${closeDate}`);
    await setDoc(ref, payload);
    return { ok: true, docId: ref.id };
  }
  return { ok: false, message: 'Firebase not configured.' };
}

/** Msimamizi anathibitisha Opening Stock ya asubuhi.
 *  Mara moja huunda/ki-upsert Current Stock kwa siku hiyo.
 *  Hudumisha bidhaa zozote waliyoweka admin tayari kwenye Current Stock (upsert
 *  kwa jina) — ili usifute bidhaa alizoongeza katikati ya siku. */
export async function confirmOpeningStock(
  openingId: string,
  manager?: { fullName?: string } | null
): Promise<{ ok: boolean; message?: string }> {
  if (!isFirebaseConfigured()) return { ok: false, message: 'Firebase not configured.' };
  const openingRef = doc(getDB(), COLLECTIONS.openingStocks, openingId);
  await updateDoc(openingRef, {
    status: 'confirmed',
    confirmedAt: new Date().toISOString(),
    managerConfirmedByName: manager?.fullName ?? '',
  });
  // Ongeza/merge Current Stock — hii ndiyo msingi wa closing calculation.
  const fb = await import('firebase/firestore');
  const openingSnap = await fb.getDoc(openingRef);
  if (openingSnap.exists()) {
    const opening = mapOpeningStock(openingRef.id, openingSnap.data() as Record<string, unknown>);
    const currentRef = doc(getDB(), COLLECTIONS.currentStocks, `${opening.shopId}_${opening.date}`);
    let currentItems: CurrentStockItem[] = [];
    const currentSnap = await fb.getDoc(currentRef);
    if (currentSnap.exists()) {
      currentItems = mapCurrentStock(currentSnap.id, currentSnap.data() as Record<string, unknown>).items;
    }
    // OPENING (iliyozalishwa na approval ya closing) ndiyo msingi wa current stock:
    // items zakihisi sawasawa na opening, na kuongeza bidhaa ambazo current alikuwa
    // nazo lakini hazimo kwenye opening (za mchana kutoka admin). Hii inazuia current
    // kurudi list/hesabu ya zamani baada ya approval mpya.
    const merged: CurrentStockItem[] = [];
    const seen = new Set<string>();
    for (const it of opening.items) {
      merged.push({ name: it.name, qty: it.qty, price: it.price });
      seen.add(it.name);
    }
    for (const it of currentItems) {
      if (!seen.has(it.name)) {
        merged.push(it);
        seen.add(it.name);
      }
    }
    await setDoc(currentRef, {
      shopId: opening.shopId,
      shopName: opening.shopName,
      date: opening.date,
      items: merged,
      createdAt: opening.createdAt ?? new Date().toISOString(),
    }, { merge: true });
  }
  return { ok: true };
}

/** Msimamizi aliyesajiliwa kwenye kifaa hiki, au null kama bado hajasajiliwa. */
export async function getCurrentManager(): Promise<ManagerProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as ManagerProfile) : null;
  } catch {
    return null;
  }
}

/** Badilisha baadhi ya taarifa za msimamizi (mf. jina la msimamizi). */
export async function updateManager(updates: Partial<ManagerProfile>): Promise<void> {
  const current = await getCurrentManager();
  if (!current) return;
  await AsyncStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({ ...current, ...updates })
  );
}

/** Weka upya (remove) profile ya msimamizi — kwa kujaribu onboarding tena. */
export async function clearManagerProfile(): Promise<void> {
  await AsyncStorage.removeItem(PROFILE_KEY);
}

/* ==================================================== CASH RECONCILIATION */

function mapCashReconciliation(id: string, data: Record<string, unknown>): CashReconciliation {
  const openingCash = Number(data.openingCash ?? 0);
  const salesRevenue = Number(data.salesRevenue ?? 0);
  const cashIn = Number(data.cashIn ?? 0);
  const cashOut = Number(data.cashOut ?? 0);
  const expectedCash = Number(data.expectedCash ?? 0);
  const countedCash = Number(data.countedCash ?? 0);
  const variance = countedCash - expectedCash;
  return {
    id,
    shopId: String(data.shopId ?? ''),
    shopName: String(data.shopName ?? ''),
    date: String(data.date ?? todayDateKey()),
    openingCash,
    openingCashSource: data.openingCashSource ? String(data.openingCashSource) : undefined,
    salesRevenue,
    cashIn,
    cashOut,
    expensesTotal: Number(data.expensesTotal ?? 0),
    receivingTotal: Number(data.receivingTotal ?? 0),
    requestTotal: Number(data.requestTotal ?? 0),
    moneyOut: Number(data.moneyOut ?? 0),
    adminAdjustment: data.adminAdjustment == null ? undefined : Number(data.adminAdjustment),
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

/** Expected Cash ya leo inapakuliwa kiotomatiki (kwenye closing approved ya leo). */
export function subscribeCashReconciliation(
  branchId: string,
  onData: (rec: CashReconciliation | null) => void,
  onError?: (err: unknown) => void,
  dateKey?: string
): () => void {
  if (!isFirebaseConfigured()) {
    onData(null);
    return () => {};
  }
  const ref = doc(getDB(), COLLECTIONS.cashReconciliations, `${branchId}_${dateKey ?? todayDateKey()}`);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(mapCashReconciliation(snap.id, snap.data() as Record<string, unknown>));
    },
    (err) => onError?.(err)
  );
}

/** Pata sales revenue ya closing approved kwa duka na siku. */
export async function getApprovedSalesRevenue(
  branchId: string,
  dateKey?: string
): Promise<number> {
  if (!isFirebaseConfigured()) return 0;
  const ref = doc(getDB(), COLLECTIONS.closingReports, `${branchId}_${dateKey ?? todayDateKey()}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return 0;
  const data = snap.data() as Record<string, unknown>;
  if (String(data.status ?? '') !== 'approved') return 0;
  return Number(data.totalRevenue ?? 0) || 0;
}

function prevDateKey(dateKey: string): string {
  const d = new Date(dateKey + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function txTotalOf(data: Record<string, unknown>): number {
  const t = Number(data.total ?? 0);
  if (t > 0) return t;
  if (Array.isArray(data.items)) {
    return (data.items as Record<string, unknown>[]).reduce(
      (s, it) => s + (Number(it.qty ?? 0) || 0) * (Number(it.price ?? 0) || 0),
      0
    );
  }
  return 0;
}

/** MALIPO YA LEO — jumla ya pesa zilizotoka kwenye till siku hiyo:
 *  Expenses + Stock Receiving + Stock Request (moja kwa moja kutoka kwenye modules). */
export async function getDayMoneyOut(
  branchId: string,
  dateKey?: string
): Promise<{ expenses: number; receiving: number; request: number; total: number }> {
  const empty = { expenses: 0, receiving: 0, request: 0, total: 0 };
  if (!isFirebaseConfigured()) return empty;
  try {
    const date = dateKey ?? todayDateKey();
    const [expSnap, recSnap, reqSnap] = await Promise.all([
      getDocs(
        query(
          collection(getDB(), COLLECTIONS.expenses),
          where('shopId', '==', branchId),
          where('date', '==', date)
        )
      ),
      getDocs(
        query(
          collection(getDB(), COLLECTIONS.stockReceiving),
          where('shopId', '==', branchId),
          where('date', '==', date)
        )
      ),
      getDocs(
        query(
          collection(getDB(), COLLECTIONS.stockRequests),
          where('shopId', '==', branchId),
          where('date', '==', date)
        )
      ),
    ]);
    let expenses = 0;
    expSnap.forEach((d) => {
      expenses += Number((d.data() as Record<string, unknown>).total ?? 0) || 0;
    });
    let receiving = 0;
    recSnap.forEach((d) => {
      receiving += txTotalOf(d.data() as Record<string, unknown>);
    });
    let request = 0;
    reqSnap.forEach((d) => {
      request += txTotalOf(d.data() as Record<string, unknown>);
    });
    return { expenses, receiving, request, total: expenses + receiving + request };
  } catch {
    return empty;
  }
}

/** CASH ILIYOFUNGA JANA — inakuwa Opening Cash ya leo (kutoka counted ya reconciliation jana). */
export async function getPreviousDayCountedCash(
  branchId: string,
  dateKey?: string
): Promise<{ cash: number; sourceDate: string }> {
  const date = dateKey ?? todayDateKey();
  const prev = prevDateKey(date);
  if (!isFirebaseConfigured()) return { cash: 0, sourceDate: prev };
  try {
    const ref = doc(getDB(), COLLECTIONS.cashReconciliations, `${branchId}_${prev}`);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { cash: 0, sourceDate: prev };
    const rec = mapCashReconciliation(snap.id, snap.data() as Record<string, unknown>);
    return { cash: rec.countedCash, sourceDate: prev };
  } catch {
    return { cash: 0, sourceDate: prev };
  }
}

/** Wasilisha Cash Reconciliation — msimamizi anaingiza counted cash (na malipo yanajumlishwa automatically kutoka kwenye modules). */
export async function submitCashReconciliation(
  profile: Pick<ManagerProfile, 'branchId' | 'branchName' | 'fullName' | 'userId'>,
  input: {
    salesRevenue: number;
    openingCash: number;
    openingCashSource?: string;
    cashIn: number;
    cashOut: number;
    expensesTotal: number;
    receivingTotal: number;
    requestTotal: number;
    moneyOut: number;
    countedCash: number;
    note?: string;
  },
  dateKey?: string
): Promise<{ ok: boolean; message?: string; docId?: string }> {
  const date = dateKey ?? todayDateKey();
  const expectedCash = input.openingCash + input.salesRevenue + input.cashIn - input.cashOut - input.moneyOut;
  const payload = {
    shopId: profile.branchId,
    shopName: profile.branchName,
    date,
    openingCash: input.openingCash,
    openingCashSource: input.openingCashSource || null,
    salesRevenue: input.salesRevenue,
    cashIn: input.cashIn,
    cashOut: input.cashOut,
    expensesTotal: input.expensesTotal,
    receivingTotal: input.receivingTotal,
    requestTotal: input.requestTotal,
    moneyOut: input.moneyOut,
    expectedCash,
    countedCash: input.countedCash,
    variance: input.countedCash - expectedCash,
    note: input.note?.trim() || null,
    managerName: profile.fullName,
    createdBy: profile.userId,
    status: 'pending_admin',
    submittedAt: new Date().toISOString(),
  };
  if (isFirebaseConfigured()) {
    const ref = doc(getDB(), COLLECTIONS.cashReconciliations, `${profile.branchId}_${date}`);
    await setDoc(ref, payload);
    return { ok: true, docId: ref.id };
  }
  return { ok: false, message: 'Firebase not configured.' };
}

/* ================================================== STOCK RECEIVING */
/** Wasilisha Stock Receiving — bidhaa zilizopokelewa (delivery), status pending_admin. */
export async function submitStockReceiving(
  profile: Pick<ManagerProfile, 'branchId' | 'branchName' | 'fullName' | 'userId'>,
  items: StockReceivingItem[],
  note?: string,
  dateKey?: string
): Promise<{ ok: boolean; message?: string; docId?: string }> {
  const clean = items.filter((i) => i.qty > 0);
  if (clean.length === 0) return { ok: false, message: 'No receiving items entered.' };
  const total = clean.reduce((s, i) => s + i.qty * i.price, 0);
  if (isFirebaseConfigured()) {
    const ref = await addDoc(collection(getDB(), COLLECTIONS.stockReceiving), {
      shopId: profile.branchId,
      shopName: profile.branchName,
      date: dateKey ?? todayDateKey(),
      items: clean,
      total,
      note: note?.trim() || null,
      managerName: profile.fullName,
      createdBy: profile.userId,
      status: 'pending_admin',
      submittedAt: new Date().toISOString(),
    });
    return { ok: true, docId: ref.id };
  }
  return { ok: false, message: 'Firebase not configured.' };
}

/* =================================================== STOCK REQUEST */
/** Wasilisha Stock Request — bidhaa unazohitaji kutoka kwa admin. */
export async function submitStockRequest(
  profile: Pick<ManagerProfile, 'branchId' | 'branchName' | 'fullName' | 'userId'>,
  items: StockRequestItem[],
  reason?: string,
  dateKey?: string
): Promise<{ ok: boolean; message?: string; docId?: string }> {
  const clean = items.filter((i) => i.qty > 0);
  if (clean.length === 0) return { ok: false, message: 'No requested items entered.' };
  const total = clean.reduce((s, i) => s + i.qty * i.price, 0);
  if (isFirebaseConfigured()) {
    const ref = await addDoc(collection(getDB(), COLLECTIONS.stockRequests), {
      shopId: profile.branchId,
      shopName: profile.branchName,
      date: dateKey ?? todayDateKey(),
      items: clean,
      total,
      reason: reason?.trim() || null,
      managerName: profile.fullName,
      createdBy: profile.userId,
      status: 'pending_admin',
      submittedAt: new Date().toISOString(),
    });
    return { ok: true, docId: ref.id };
  }
  return { ok: false, message: 'Firebase not configured.' };
}

/* ===================================================== EXPENSES */
export function mapExpenseSubmission(
  id: string,
  data: Record<string, unknown>
): ExpenseSubmission {
  const items = Array.isArray(data.items)
    ? (data.items as Record<string, unknown>[]).map((it) => ({
        description: String(it.description ?? ''),
        amount: Number(it.amount ?? 0),
        category: it.category ? String(it.category) : undefined,
      }))
    : [];
  return {
    id,
    shopId: String(data.shopId ?? ''),
    shopName: String(data.shopName ?? ''),
    date: String(data.date ?? todayDateKey()),
    items,
    total: Number(data.total ?? items.reduce((s, i) => s + i.amount, 0)),
    status: data.status === 'approved' ? 'approved' : 'pending_admin',
    managerName: data.managerName ? String(data.managerName) : undefined,
    submittedAt: data.submittedAt ? String(data.submittedAt) : undefined,
  };
}

/** Wasilisha Expenses — orodha ya matumizi (maelezo + bei). */
export async function submitExpenses(
  profile: Pick<ManagerProfile, 'branchId' | 'branchName' | 'fullName' | 'userId'>,
  items: ExpenseItem[],
  dateKey?: string
): Promise<{ ok: boolean; message?: string; docId?: string }> {
  const clean = items.filter((i) => i.description.trim() && i.amount > 0);
  if (clean.length === 0) return { ok: false, message: 'Add at least one expense first.' };
  const total = clean.reduce((s, i) => s + i.amount, 0);
  if (isFirebaseConfigured()) {
    const ref = await addDoc(collection(getDB(), COLLECTIONS.expenses), {
      shopId: profile.branchId,
      shopName: profile.branchName,
      date: dateKey ?? todayDateKey(),
      items: clean,
      total,
      managerName: profile.fullName,
      createdBy: profile.userId,
      status: 'pending_admin',
      submittedAt: new Date().toISOString(),
    });
    return { ok: true, docId: ref.id };
  }
  return { ok: false, message: 'Firebase not configured.' };
}

/** Historia ya expenses za duka (za karibuni kwenda zamani). */
export function subscribeExpenses(
  branchId: string,
  onData: (expenses: ExpenseSubmission[]) => void,
  onError?: (err: unknown) => void,
  limitN?: number
): () => void {
  if (!isFirebaseConfigured()) {
    onData([]);
    return () => {};
  }
  const max = limitN ?? 20;
  const q = query(
    collection(getDB(), COLLECTIONS.expenses),
    where('shopId', '==', branchId),
    orderBy('submittedAt', 'desc'),
    limit(max)
  );
  const unsub = onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => mapExpenseSubmission(d.id, d.data() as Record<string, unknown>))
      );
    },
    (err) => onError?.(err)
  );
  return unsub;
}

/* ===================================================== BRANCH REPORTS */

function mapTxItemsForBranch(raw: unknown): StockReceivingItem[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((it) => ({
    name: String(it.name ?? ''),
    price: Number(it.price ?? 0),
    qty: Number(it.qty ?? 0),
  }));
}

async function getDocsWhere(collectionName: string, branchId: string) {
  const q = query(collection(getDB(), COLLECTIONS[collectionName as keyof typeof COLLECTIONS]), where('shopId', '==', branchId));
  return getDocs(q);
}

/** Closing reports zote za duka (zambaridi kwa tarehe). */
export async function getClosingReportsForBranch(branchId: string): Promise<ClosingStock[]> {
  if (!isFirebaseConfigured()) return [];
  const snap = await getDocsWhere('closingReports', branchId);
  return snap.docs
    .map((d) => mapClosingStock(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Stock receiving records za duka. */
export async function getReceivingForBranch(branchId: string): Promise<StockReceiving[]> {
  if (!isFirebaseConfigured()) return [];
  const snap = await getDocsWhere('stockReceiving', branchId);
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    const items = mapTxItemsForBranch(data.items);
    return {
      id: d.id,
      shopId: String(data.shopId ?? ''),
      shopName: String(data.shopName ?? ''),
      date: String(data.date ?? todayDateKey()),
      items,
      total: Number(data.total ?? items.reduce((s, i) => s + i.price * i.qty, 0)),
      status: data.status === 'approved' ? 'approved' : 'pending_admin',
      managerName: data.managerName ? String(data.managerName) : undefined,
      note: data.note ? String(data.note) : undefined,
      submittedAt: data.submittedAt ? String(data.submittedAt) : undefined,
    };
  });
}

/** Stock requests za duka. */
export async function getRequestsForBranch(branchId: string): Promise<StockRequest[]> {
  if (!isFirebaseConfigured()) return [];
  const snap = await getDocsWhere('stockRequests', branchId);
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    const items = mapTxItemsForBranch(data.items);
    return {
      id: d.id,
      shopId: String(data.shopId ?? ''),
      shopName: String(data.shopName ?? ''),
      date: String(data.date ?? todayDateKey()),
      items,
      reason: data.reason ? String(data.reason) : undefined,
      status: data.status === 'approved' ? 'approved' : 'pending_admin',
      managerName: data.managerName ? String(data.managerName) : undefined,
      submittedAt: data.submittedAt ? String(data.submittedAt) : undefined,
    };
  });
}

/** Opening stocks za duka (timeline / history). */
export async function getOpeningsForBranch(branchId: string): Promise<OpeningStock[]> {
  if (!isFirebaseConfigured()) return [];
  const snap = await getDocsWhere('openingStocks', branchId);
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    const items = Array.isArray(data.items)
      ? (data.items as Record<string, unknown>[]).map((it) => ({
          name: String(it.name ?? ''),
          qty: Number(it.qty ?? 0),
          price: Number(it.price ?? 0),
          total: Number(it.total ?? 0),
        }))
      : [];
    return {
      id: d.id,
      shopId: String(data.shopId ?? ''),
      shopName: String(data.shopName ?? ''),
      date: String(data.date ?? todayDateKey()),
      items,
      total: Number(data.total ?? 0),
      status: (data.status as OpeningStock['status']) ?? 'generated',
      sourceClosingId: data.sourceClosingId ? String(data.sourceClosingId) : undefined,
      createdAt: data.createdAt ? String(data.createdAt) : undefined,
    };
  });
}

/** Cash reconciliations zote za duka. */
export async function getCashReconciliationsForBranch(branchId: string): Promise<CashReconciliation[]> {
  if (!isFirebaseConfigured()) return [];
  const snap = await getDocsWhere('cashReconciliations', branchId);
  return snap.docs
    .map((d) => mapCashReconciliation(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Expense submissions zote za duka (zaidi ya 50 zikiwepo zinachujwa). */
export async function getExpensesForBranch(branchId: string): Promise<ExpenseSubmission[]> {
  if (!isFirebaseConfigured()) return [];
  const snap = await getDocs(collection(getDB(), COLLECTIONS.expenses));
  return snap.docs
    .filter((d) => (d.data() as Record<string, unknown>).shopId === branchId)
    .map((d) => mapExpenseSubmission(d.id, d.data() as Record<string, unknown>));
}