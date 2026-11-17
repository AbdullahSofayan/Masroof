import { canAnimate, useReducedMotion } from '../reactbits/motionSafety';

export function useFintechMotion() {
  const reduced = useReducedMotion();
  const enabled = !reduced && canAnimate();
  return {
    enabled,
    layoutEnabled: enabled && typeof IntersectionObserver === 'function' && typeof ResizeObserver === 'function',
  };
}

export function canMeasureSvgPath() {
  if (typeof document === 'undefined') return false;
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  if (typeof path.getTotalLength !== 'function') return false;
  try {
    path.setAttribute('d', 'M0 0 L1 1');
    return Number.isFinite(path.getTotalLength());
  } catch { return false; }
}
