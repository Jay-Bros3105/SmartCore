/**
 * Maduka (branches) — kwa sasa ni MOCK data inayoiga maduka ambayo admin
 * amekwishayapanga (assign) kwenye admin dashboard.
 *
 * Wakati Firebase iko (USE_FIREBASE=true), list hii hutokana NA Firestore
 * collection `branches` (iliyowekwa na admin) — hii folder itatumika tu
 * kwenye mode ya maandamano (offline/preview).
 */
import type { Branch } from '../services/types';

export const mockBranches: Branch[] = [
  {
    id: 'br-kariakoo',
    name: 'Kariakoo Shop',
    region: 'dar',
    address: 'Kariakoo Market, Dar es Salaam',
    location: null,
    status: 'active',
    createdAt: '2026-08-01T08:00:00.000Z',
  },
  {
    id: 'br-manzese',
    name: 'Manzese Shop',
    region: 'dar',
    address: 'Manzese, Dar es Salaam',
    location: null,
    status: 'active',
    createdAt: '2026-08-01T08:00:00.000Z',
  },
  {
    id: 'br-mbezi',
    name: 'Mbezi Beach Shop',
    region: 'dar',
    address: 'Mbezi Beach, Dar es Salaam',
    location: null,
    status: 'active',
    createdAt: '2026-08-03T08:00:00.000Z',
  },
  {
    id: 'br-mwanza',
    name: 'Mwanza Shop',
    region: 'mwanza',
    address: 'Mwanza city center',
    location: null,
    status: 'active',
    createdAt: '2026-08-05T08:00:00.000Z',
  },
  {
    id: 'br-arusha',
    name: 'Arusha Shop',
    region: 'arusha',
    address: 'Arusha city center',
    location: null,
    status: 'active',
    createdAt: '2026-08-05T08:00:00.000Z',
  },
  {
    id: 'br-morogoro',
    name: 'Morogoro Shop',
    region: 'morogoro',
    address: 'Morogoro town',
    location: null,
    status: 'active',
    createdAt: '2026-08-08T08:00:00.000Z',
  },
  {
    id: 'br-tanga',
    name: 'Tanga Shop',
    region: 'tanga',
    address: 'Tanga city center',
    location: null,
    status: 'active',
    createdAt: '2026-08-10T08:00:00.000Z',
  },
];