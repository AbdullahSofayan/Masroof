import { useEffect, useState } from 'react';

export const canAnimate = () => typeof window !== 'undefined'
  && typeof requestAnimationFrame === 'function'
  && typeof cancelAnimationFrame === 'function';

function motionQuery() {
  try { return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null; }
  catch { return null; }
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && Boolean(motionQuery()?.matches));
  useEffect(() => {
    const query = motionQuery();
    if (!query) return;
    const update = () => setReduced(query.matches);
    update();
    if (query.addEventListener) query.addEventListener('change', update);
    else query.addListener?.(update);
    return () => {
      if (query.removeEventListener) query.removeEventListener('change', update);
      else query.removeListener?.(update);
    };
  }, []);
  return reduced;
}

export function useSafeInView(ref, immediate = false) {
  const [visible, setVisible] = useState(immediate);
  useEffect(() => {
    if (immediate || typeof IntersectionObserver !== 'function') { setVisible(true); return; }
    if (!ref.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, immediate]);
  return visible;
}

export function getCanvasContext(canvas) {
  // JSDOM exposes getContext but has no rendering backend unless a canvas implementation is installed.
  if (!canvas || typeof canvas.getContext !== 'function' || typeof window === 'undefined'
    || typeof window.CanvasRenderingContext2D !== 'function') return null;
  try { return canvas.getContext('2d'); } catch { return null; }
}
