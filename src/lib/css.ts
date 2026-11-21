import type { CSSProperties } from 'react';
import type { MotionStyle } from 'framer-motion';

/** Typed helper for inline CSS custom properties (works on DOM and motion elements). */
export function vars(v: Record<string, string | number>, extra?: CSSProperties): CSSProperties & MotionStyle {
  return { ...extra, ...v } as unknown as CSSProperties & MotionStyle;
}
