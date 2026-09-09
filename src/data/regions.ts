const REGION_LABELS: Record<string, string> = {
  mwanza: 'Mwanza',
  dar: 'Dar es Salaam',
  arusha: 'Arusha',
  morogoro: 'Morogoro',
  mbeya: 'Mbeya',
  tanga: 'Tanga',
  kilimanjaro: 'Kilimanjaro',
  other: 'Other',
};

export function regionLabel(region: string): string {
  return REGION_LABELS[region] ?? region;
}
