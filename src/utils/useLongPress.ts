import React, { useRef, useCallback } from 'react';

interface UseLongPressOptions {
  threshold?: number;
  onLongPress: () => void;
  onClick?: () => void;
}

export function useLongPress({ threshold = 400, onLongPress, onClick }: UseLongPressOptions) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef<boolean>(false);

  const start = useCallback(() => {
    isLongPressRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(40);
        } catch {
          // ignore
        }
      }
      onLongPress();
    }, threshold);
  }, [onLongPress, threshold]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isLongPressRef.current) {
        e.preventDefault();
        e.stopPropagation();
        isLongPressRef.current = false;
        return;
      }
      if (onClick) {
        onClick();
      }
    },
    [onClick]
  );

  return {
    handlers: {
      onPointerDown: start,
      onPointerUp: stop,
      onPointerLeave: stop,
      onPointerCancel: stop,
      onClick: handleClick,
    },
    isLongPressRef,
  };
}
