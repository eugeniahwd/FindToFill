'use client';

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

/** A drag shorter than this (px) counts as a tap. */
const TAP_MAX_PX = 6;
/** A drag at least this long (px) opens or closes the sheet. */
const SWIPE_MIN_PX = 40;

/**
 * The sheet's state after a drag of `dy` px (negative = up): a long drag up opens it, a long drag
 * down closes it, a tap toggles it, and a short wobble keeps it as it was.
 */
export function resolveSheetDrag(expanded: boolean, dy: number): boolean {
  if (Math.abs(dy) <= TAP_MAX_PX) return !expanded;
  if (dy <= -SWIPE_MIN_PX) return true;
  if (dy >= SWIPE_MIN_PX) return false;
  return expanded;
}

/**
 * Drag handle for a bottom sheet: spread `handleProps` on the handle. `dragOffset` is how far the
 * finger has moved (px, negative = up) while dragging, for the sheet to follow the finger.
 */
export function useSheetDrag(expanded: boolean, setExpanded: (next: boolean) => void) {
  const startY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const reset = () => {
    startY.current = null;
    setDragOffset(0);
    setIsDragging(false);
  };

  const handleProps = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      startY.current = e.clientY;
      setIsDragging(true);
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (startY.current !== null) setDragOffset(e.clientY - startY.current);
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      if (startY.current !== null) setExpanded(resolveSheetDrag(expanded, e.clientY - startY.current));
      reset();
    },
    onPointerCancel: reset,
    // Keyboard users still toggle with Enter/Space (pointer taps are handled above).
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setExpanded(!expanded);
      }
    },
  };

  return { handleProps, dragOffset, isDragging };
}
