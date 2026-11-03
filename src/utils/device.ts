/**
 * Hollow Strike - Device Detection Utility
 * Detects whether the primary input device is touch-based (phones, tablets)
 * without incorrectly classifying touch-enabled laptops or narrow desktop windows as mobile.
 */

export function isTouchDevice(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  const isCoarse = window.matchMedia('(pointer: coarse)').matches;
  const hasNoHover = window.matchMedia('(hover: none)').matches;

  return isCoarse && hasNoHover;
}
