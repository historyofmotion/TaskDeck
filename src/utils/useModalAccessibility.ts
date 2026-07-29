import { useEffect, useRef } from 'react';

export function useModalAccessibility(isOpen: boolean = true, onClose: () => void) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const hasFocusedInitialRef = useRef(false);

  // Initial focus management
  useEffect(() => {
    if (!isOpen) {
      hasFocusedInitialRef.current = false;
      return;
    }

    if (!hasFocusedInitialRef.current) {
      hasFocusedInitialRef.current = true;
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;

      const timer = setTimeout(() => {
        if (modalRef.current) {
          const isAlreadyInside = modalRef.current.contains(document.activeElement);
          if (!isAlreadyInside) {
            const focusables = modalRef.current.querySelectorAll<HTMLElement>(
              'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            if (focusables.length > 0) {
              focusables[0].focus();
            } else {
              modalRef.current.focus();
            }
          }
        }
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Keydown event listener for Escape and Tab focus trapping
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const elements = Array.from(
          modalRef.current.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ) as HTMLElement[];

        const focusables = elements.filter(
          (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement
        );

        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Restore focus on unmount
  useEffect(() => {
    return () => {
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      }
    };
  }, []);

  return modalRef;
}
