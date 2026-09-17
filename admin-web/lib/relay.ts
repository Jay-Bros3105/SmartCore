/**
 * Neo SmartCore — relay client (admin web).
 *
 * Wakati admin anapothibitisha (approve) closing/receiving/request/expense/
 * reconciliation/shop change, tunamtaarifu msimamizi kwenye kifaa chake:
 * "Admin's Approval Success — …". Hii ni fire-and-forget — usijali kama relay
 * haipatikani muda huo (app haiivunji).
 *
 * NOTE: RELAY_URL ibadilike baada ya Ku-deploy relay kwenye Glitch/Vercel.
 */
const RELAY_URL = 'https://neosmartcore-relay-jay-bros3105s-projects.vercel.app';
const RELAY_SECRET = '';

export type RelayKind =
  | 'closing_approved'
  | 'receiving_approved'
  | 'request_approved'
  | 'expense_approved'
  | 'reconciliation_approved'
  | 'shop_change_approved';

export function relayNotify(p: {
  to: 'manager' | 'admin';
  managerUserId?: string;
  kind: RelayKind;
  path?: string;
}): void {
  if (!RELAY_URL || RELAY_URL.includes('YOUR')) return;
  fetch(`${RELAY_URL}/api/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: RELAY_SECRET, ...p }),
  }).catch(() => {
    /* Relay haipatikani — usivunje admin dashboard. */
  });
}