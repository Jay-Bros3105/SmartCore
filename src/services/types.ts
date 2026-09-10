/**
 * Aina za data msingi (domain types) — zinalingana na ERD kutoka
 * "Smartcore ERD.mermaid" na proposal Section 10.
 */

/** Duka (BRANCHES) — huongezwa na admin kwenye admin dashboard.
 *  Muundo huu unalingana na doc za Firestore `branches` zilizowekwa
 *  na admin web (`region` + `address` ni muhimu, `location` inaweza kuwa
 *  na viratibu) ili maduka yaweze kuonekana live kwenye app. */
export type Branch = {
  id: string;
  name: string;
  /** Mkoa wa duka (mf. 'mwanza', 'dar', 'arusha'). */
  region: string;
  /** Anwani isiyo ya kijiografia ya duka. */
  address: string;
  /** Anwani ya kijiografia (viratibu + jina la mahali) — hiari. Mock hutumia string. */
  location?: string | { lat: number; lng: number; place: string } | null;
  status: 'active' | 'inactive';
  createdAt: string;
  /** UID wa Admin anayemiliki duka hili (kwa multi-admin). */
  ownerUid?: string;
};

/** Admin (mwenye maduka) — app inawaonyesha kama "Admin 1 · Jina" wakati wa usajili. */
export type AdminInfo = {
  uid: string;
  name: string;
  email: string;
  createdAt?: string;
};

export type ManagerRole = 'super_admin' | 'branch_manager' | 'cashier';

/** Profile ya msimamizi — hujazwa mara ya kwanza (onboarding) na data hii
 *  ndiyo inayoonekana kwa admin anapofanya approval. */
export type ManagerProfile = {
  userId: string;
  fullName: string;
  phone: string;
  role: ManagerRole;
  branchId: string;
  branchName: string;
  status: 'pending' | 'approved' | 'rejected';
  registeredAt: string;
};

export type RegistrationStatus = ManagerProfile['status'];

/** Matokeo ya onboarding — hubeba profile pamoja na hali ya mchakato. */
export type OnboardingResult =
  | { ok: true; profile: ManagerProfile }
  | { ok: false; message: string };

export type StockItem = {
  name: string;
  qty: number;
  price: number;
  total: number;
};

/**
 * OPENING STOCK ya siku — inajengwa moja kwa moja baada ya admin
 * kuapprove Closing Stock ya siku iliyopita. Doc id: `${shopId}_${YYYY-MM-DD}`.
 * Msimamizi anaanza siku akithibitisha stock hii, ndiyo reference ya Closing.
 */
export type OpeningStock = {
  id: string;
  shopId: string;
  shopName: string;
  date: string;
  items: StockItem[];
  total: number;
  status: 'generated' | 'confirmed' | 'sent';
  sourceClosingId?: string;
  createdAt?: string;
  confirmedAt?: string;
};

/**
 * CLOSING STOCK ya siku — msimamizi anaandika REMAINING qty kwa kila bidhaa,
 * mfumo hukokotoa SOLD = Current − Remaining, na revenue = sold × price.
 * Admin anaapprove (kupokea) → hujenga Current/Opening ya siku inayofuata.
 * Doc id: `${shopId}_${YYYY-MM-DD}`.
 */
export type ClosingItem = {
  name: string;
  /** Idadi iliyopo kwenye Current Stock (opening + milipuko ya siku) — lock. */
  current: number;
  price: number;
  /** Idadi iliyobaki — msimamizi anaandika hii (≤ current). */
  remaining: number;
  /** Sold = current − remaining (mfumo hukokotoa). */
  sold: number;
  /** Pesa ya mauzo = sold × price. */
  revenue: number;
};

export type ClosingStock = {
  id: string;
  shopId: string;
  shopName: string;
  date: string;
  items: ClosingItem[];
  /** Jumla ya pesa ya mauzo ya siku hiyo. */
  totalRevenue: number;
  status: 'pending_admin' | 'approved';
  managerName?: string;
  createdBy?: string;
  submittedAt: string;
  approvedAt?: string;
  /** Uthibitisho wa msimamizi kuwa malipo yote ya siku yameandikwa kabla ya kutuma. */
  expensesConfirmed?: boolean;
  moneyOutExpenses?: number;
  moneyOutReceiving?: number;
  moneyOutRequest?: number;
  moneyOutTotal?: number;
};

/**
 * CURRENT STOCK ya siku — admin pekee ana-modify (ongeza bidhaa, ongeza idadi).
 * Closing Stock inatumia hii kama kikomo (remaining ≤ current).
 * Opening stock ni previous-day approved closing.
 * Doc id: `${shopId}_${YYYY-MM-DD}`.
 */
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

/** CASH RECONCILIATION — Cash in hand vs Expected Cash.
 *  Expected = opening cash + sales revenue − MONEY-OUT (expenses + stock
 *  receiving + stock request za siku hiyo) +/− cash in/out to admin.
 *  Variance = counted − expected. Doc id: `${shopId}_${YYYY-MM-DD}`. */
export type CashReconciliation = {
  id: string;
  shopId: string;
  shopName: string;
  date: string;
  openingCash: number;
  /** Kutoka kwenye Cash Reconciliation ya siku iliyotangulia (counted). */
  openingCashSource?: string;
  salesRevenue: number;
  /** Pesa aliyoongeza admin kwenye till siku hiyo. */
  cashIn: number;
  /** Pesa aliyoitoa admin/boss kutoka till siku hiyo. */
  cashOut: number;
  /** Malipo ya leo yaliyokuja moja kwa moja kutoka kwenye modules. */
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

/** STOCK RECEIVING — msimamizi anarekodi bidhaa alizopokea (delivery).
 *  Doc id: `${shopId}_${timestamp}` (zaidi ya moja kwa siku inaweza kuwa). */
export type StockReceivingItem = {
  name: string;
  price: number;
  qty: number;
};

export type StockReceiving = {
  id: string;
  shopId: string;
  shopName: string;
  date: string;
  items: StockReceivingItem[];
  total: number;
  status: 'pending_admin' | 'approved';
  managerName?: string;
  note?: string;
  submittedAt?: string;
};

/** STOCK REQUEST — msimamizi anahitaji bidhaa kutoka kwa admin. */
export type StockRequestItem = {
  name: string;
  price: number;
  qty: number;
};

export type StockRequest = {
  id: string;
  shopId: string;
  shopName: string;
  date: string;
  items: StockRequestItem[];
  reason?: string;
  status: 'pending_admin' | 'approved';
  managerName?: string;
  submittedAt?: string;
};

/** EXPENSES — msimamizi anarekodi matumizi: kila item ina maelezo na bei. */
export type ExpenseItem = {
  description: string;
  amount: number;
  category?: string;
};

export type ExpenseSubmission = {
  id: string;
  shopId: string;
  shopName: string;
  date: string;
  items: ExpenseItem[];
  total: number;
  status: 'pending_admin' | 'approved';
  managerName?: string;
  submittedAt?: string;
};

/** OMBI LA KUBADILISHA DUKA — msimamizi hulijaza (from/to/name), admin
 *  anaapprove, na baada ya hapo msimamizi anahamia duka la mpya. */
export type ShopChangeRequest = {
  id: string;
  userId: string;
  managerName: string;
  shopFromId: string;
  shopFromName: string;
  shopToId: string;
  shopToName: string;
  status: 'pending_admin' | 'approved' | 'rejected';
  submittedAt: string;
  approvedAt?: string;
};