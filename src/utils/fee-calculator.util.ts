/**
 * Calculates the final fee for a student based on their base fee and Free Card status.
 * - FREE_CARD: 100% discount (Rs. 0)
 * - HALF_CARD: 50% discount (50% of base fee, rounded)
 * - NONE / undefined: No discount (100% of base fee)
 */
export function calculateDiscountedFee(baseFee: number, freeCardType?: string | null): number {
  if (!baseFee || baseFee <= 0) return 0;
  if (freeCardType === 'FREE_CARD') return 0;
  if (freeCardType === 'HALF_CARD') return Math.round(baseFee * 0.5);
  return Math.round(baseFee);
}
