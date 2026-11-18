/**
 * Shared device detection helper for Hollow Strike.
 * Uses (pointer: coarse) & (hover: none) so touch laptops and narrow desktop
 * windows stay in desktop mode, while honoring explicit user controlMode overrides.
 */
import { ControlMode } from './types';

export function isMobileDevice(controlMode: ControlMode = 'AUTO'): boolean {
  if (controlMode === 'TOUCH') return true;
  if (controlMode === 'DESKTOP') return false;
  if (typeof window === 'undefined') return false;
  const isCoarse = window.matchMedia('(pointer: coarse)').matches;
  const hasNoHover = window.matchMedia('(hover: none)').matches;
  return isCoarse && hasNoHover;
}
