/**
 * Neo SmartCore — relay client (app ya manager).
 *
 * Baada ya kuandika doc (request/closing/expense, n.k.), msimamizi anaitisha
 * relay bila kungoja (fire-and-forget) ili admin apokee push mara moja.
 * Ikiwa relay haipatikani, app haisimami — makosa yanapuuzwa kimya.
 *
 * RELAY_URL: production ya relay kwenye Vercel (imejaribiwa 9/2026).
 * Endpoint ni `/api/notify` — sawa kwa Vercel na Glitch.
 */
export const RELAY_URL = 'https://neosmartcore-relay-jay-bros3105s-projects.vercel.app';
const RELAY_SECRET = '';

export type RelayKind =
  | 'stock_request'
  | 'stock_receiving'
  | 'expense'
  | 'closing'
  | 'reconciliation'
  | 'shop_change'
  | 'registration';

export interface RelayEnvelope {
  to: 'admin' | 'manager';
  managerUserId?: string;
  shopId?: string;
  shopName?: string;
  kind: RelayKind;
  path?: string;
  label?: string;
  items?: { name: string; remaining: number }[];
}

/** Fire-and-forget: hakuna await, makosa yanapuuzwa. */
export function notifyRelay(envelope: RelayEnvelope): void {
  if (!RELAY_URL || RELAY_URL.includes('YOUR')) return;
  fetch(`${RELAY_URL}/api/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: RELAY_SECRET, ...envelope }),
  }).catch(() => {
    /* Relay haipatikani au inawaka — usivunje app. */
  });
}