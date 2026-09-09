/**
 * Mock data ya admin dashboard — hii ndiyo inatumika na pages zote
 * za admin web sasa. Wakati Firebase itakapounganishwa, data hii
 * itatokana na Firestore (branches, users, registrations etc).
 */

export type Branch = { id: string; name: string; location: string; status: 'active' | 'inactive'; createdAt?: string };
export type ManagerRegistration = {
  userId: string;
  fullName: string;
  phone: string;
  branchId: string;
  branchName: string;
  status: 'pending' | 'approved' | 'rejected';
  registeredAt: string;
};
export type User = {
  userId: string;
  fullName: string;
  phone: string;
  role: 'super_admin' | 'branch_manager' | 'cashier';
  branchId?: string;
  branchName?: string;
  status: string;
};
export type Product = {
  productId: string;
  name: string;
  unit: string;
  category: string;
  minStock: number;
  reorderLevel: number;
  buyingPrice: number;
  sellingPrice: number;
};

const now = new Date().toISOString();

export const mockBranches: Branch[] = [
  { id: 'br-kariakoo', name: 'Duka la Kariakoo', location: 'Kariakoo, DSM', status: 'active' },
  { id: 'br-manzese', name: 'Duka la Manzese', location: 'Manzese, DSM', status: 'active' },
  { id: 'br-mbezi', name: 'Duka la Mbezi Beach', location: 'Mbezi Beach, DSM', status: 'active' },
  { id: 'br-mwanza', name: 'Duka la Mwanza', location: 'Mwanza', status: 'active' },
  { id: 'br-arusha', name: 'Duka la Arusha', location: 'Arusha', status: 'active' },
  { id: 'br-morogoro', name: 'Duka la Morogoro', location: 'Morogoro', status: 'active' },
  { id: 'br-tanga', name: 'Duka la Tanga', location: 'Tanga', status: 'active' },
];

export const mockRegistrations: ManagerRegistration[] = [
  { userId: 'usr-1', fullName: 'Juma Mwakalinga', phone: '0712345678', branchId: 'br-kariakoo', branchName: 'Duka la Kariakoo', status: 'approved', registeredAt: '2026-08-15T09:00:00.000Z' },
  { userId: 'usr-2', fullName: 'Amina Hassan', phone: '0754123456', branchId: 'br-manzese', branchName: 'Duka la Manzese', status: 'approved', registeredAt: '2026-08-18T09:00:00.000Z' },
  { userId: 'usr-3', fullName: 'Bakari Mushi', phone: '0767123456', branchId: 'br-mbezi', branchName: 'Duka la Mbezi Beach', status: 'approved', registeredAt: '2026-08-20T09:00:00.000Z' },
  { userId: 'usr-4', fullName: 'Neema Kimaro', phone: '0786123456', branchId: 'br-mwanza', branchName: 'Duka la Mwanza', status: 'approved', registeredAt: '2026-08-22T09:00:00.000Z' },
  { userId: 'usr-5', fullName: 'Salum Bakari', phone: '0713456789', branchId: 'br-arusha', branchName: 'Duka la Arusha', status: 'approved', registeredAt: '2026-09-01T09:00:00.000Z' },
  { userId: 'usr-6', fullName: 'Rehema Nyerere', phone: '0719123456', branchId: 'br-morogoro', branchName: 'Duka la Morogoro', status: 'approved', registeredAt: '2026-09-02T09:00:00.000Z' },
  { userId: 'usr-7', fullName: 'Issa Kileo', phone: '0778123456', branchId: 'br-tanga', branchName: 'Duka la Tanga', status: 'approved', registeredAt: '2026-09-03T09:00:00.000Z' },
  { userId: 'usr-8', fullName: 'Asheri John', phone: '0715000111', branchId: 'br-kariakoo', branchName: 'Duka la Kariakoo', status: 'pending', registeredAt: now },
];

export const mockUsers: User[] = mockRegistrations
  .filter((r) => r.status === 'approved')
  .map((r) => ({
    userId: r.userId,
    fullName: r.fullName,
    phone: r.phone,
    role: 'branch_manager' as const,
    branchId: r.branchId,
    branchName: r.branchName,
    status: 'active',
  }));

export const mockProducts: Product[] = [
  { productId: 'p1', name: 'Sabuni ya Kufulia', unit: 'mche', category: 'Utakaso', minStock: 10, reorderLevel: 20, buyingPrice: 2500, sellingPrice: 4000 },
  { productId: 'p2', name: 'Mafuta ya Kupikia (L)', unit: 'lita', category: 'Chakula', minStock: 5, reorderLevel: 15, buyingPrice: 4000, sellingPrice: 6500 },
  { productId: 'p3', name: 'Pembejeo za Kuku', unit: 'kg', category: 'Mifugo', minStock: 8, reorderLevel: 12, buyingPrice: 3500, sellingPrice: 5500 },
  { productId: 'p4', name: 'Mche wa Maji', unit: 'mche', category: 'Maji', minStock: 15, reorderLevel: 25, buyingPrice: 1800, sellingPrice: 2500 },
  { productId: 'p5', name: 'Sukari (kg)', unit: 'kg', category: 'Chakula', minStock: 20, reorderLevel: 30, buyingPrice: 3000, sellingPrice: 4200 },
  { productId: 'p6', name: 'Chumvi ya Mswaki', unit: 'mche', category: 'Utakaso', minStock: 30, reorderLevel: 50, buyingPrice: 500, sellingPrice: 1000 },
];

export const mockSales = [
  { day: 'Jumatatu', amount: 1865000 },
  { day: 'Jumanne', amount: 2130000 },
  { day: 'Jumatano', amount: 1978000 },
  { day: 'Alhamisi', amount: 2345000 },
  { day: 'Ijumaa', amount: 2870000 },
  { day: 'Jumamosi', amount: 3120000 },
  { day: 'Jumapili', amount: 1650000 },
];

/** Helper: fungua ukurasa moja kutoka pathname. */
export function activePage(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

/** Helper: format TSh */
export function formatTsh(n: number): string {
  return 'TSh ' + n.toLocaleString('en-US');
}

/** Helper: pata badge class */
export function badgeClass(status: string): string {
  if (status === 'approved' || status === 'active') return 'badge-ok';
  if (status === 'pending') return 'badge-pending';
  return 'badge-danger';
}