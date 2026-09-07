import { useState, useEffect } from 'react';

/**
 * Hook para detectar si el teclado virtual nativo del teléfono/dispositivo está activo.
 * Cuando el teclado del celular se abre, desactiva/oculta los teclados numéricos en pantalla
 * de la aplicación para evitar solapamientos y liberar espacio visual.
 */
export function useVirtualKeyboard(): boolean {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState<boolean>(false);

  useEffect(() => {
    const checkIfTextInput = (el: Element | null): boolean => {
      if (!el) return false;
      const tagName = el.tagName.toLowerCase();
      if (tagName === 'textarea') return true;
      if (tagName === 'input') {
        const input = el as HTMLInputElement;
        const type = (input.type || 'text').toLowerCase();
        // Si tiene inputMode="none", se maneja con el teclado virtual de la app, no con el teclado del cel
        if (input.inputMode === 'none') return false;
        // Tipos que abren teclado nativo del cel
        const textTypes = ['text', 'search', 'email', 'tel', 'url', 'number', 'password'];
        return textTypes.includes(type);
      }
      if ((el as HTMLElement).isContentEditable) return true;
      return false;
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as Element | null;
      if (checkIfTextInput(target)) {
        setIsKeyboardOpen(true);
      }
    };

    const handleFocusOut = () => {
      // Pequeño retardo para verificar si el foco pasó a otro input de texto o si se cerró
      setTimeout(() => {
        const active = document.activeElement;
        const isStillText = checkIfTextInput(active);
        
        if (!isStillText) {
          if (window.visualViewport) {
            const heightDiff = window.innerHeight - window.visualViewport.height;
            setIsKeyboardOpen(heightDiff > 120);
          } else {
            setIsKeyboardOpen(false);
          }
        }
      }, 60);
    };

    const handleViewportResize = () => {
      if (window.visualViewport) {
        const heightDiff = window.innerHeight - window.visualViewport.height;
        // Si la pantalla se reduce más de 120px suele ser el teclado de Android/iOS
        if (heightDiff > 120) {
          setIsKeyboardOpen(true);
        } else {
          // Si el viewport vuelve al tamaño completo y no hay foco en texto, se desactiva
          const active = document.activeElement;
          if (!checkIfTextInput(active)) {
            setIsKeyboardOpen(false);
          }
        }
      }
    };

    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
      window.visualViewport.addEventListener('scroll', handleViewportResize);
    }

    return () => {
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize);
        window.visualViewport.removeEventListener('scroll', handleViewportResize);
      }
    };
  }, []);

  return isKeyboardOpen;
}
