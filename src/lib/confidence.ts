export function confidenceLabel(value?: number) {
  if (value === undefined) return 'Not available';
  if (value >= 0.8) return 'High';
  if (value >= 0.6) return 'Mixed';
  return 'Low';
}
