/**
 * Data ya mfano (mock data) — itabadilishwa na majibu ya kweli ya API
 * yatakayotoka kwenye backend (Node.js/NestJS au Django, angalia proposal
 * Sehemu ya 9) mara itakapounganishwa.
 */

export const currentUser = {
  fullName: 'John Mwakalinga',
  role: 'branch_manager' as const,
  branchName: 'Kariakoo Shop',
};

export const todaySummary = {
  date: new Date(),
  shiftOpen: true,
  expectedCash: 186500,
  lowStockCount: 3,
  pendingApprovals: 1,
  varianceStatus: 'ok' as 'ok' | 'warning' | 'danger', // ok=no variance, warning=low stock, danger=variance detected
};

export const recentActivity = [
  {
    id: '1',
    title: 'Daily closing submitted',
    subtitle: 'Yesterday · No variance',
    type: 'success' as const,
  },
  {
    id: '2',
    title: 'Stock request sent',
    subtitle: 'Washing soap — 20 pieces',
    type: 'pending' as const,
  },
  {
    id: '3',
    title: 'Stock running low',
    subtitle: 'Cooking oil — only 4 left',
    type: 'warning' as const,
  },
];
