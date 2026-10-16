import { useEffect, useCallback } from 'react';

interface ShortcutHandler {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  handler: () => void;
  description: string;
}

// Check if an element is an input-like element
const isInputElement = (element: Element | null): boolean => {
  if (!element) return false;
  const tagName = element.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    (element as HTMLElement).isContentEditable
  );
};

/**
 * Hook for managing global keyboard shortcuts
 */
export const useKeyboardShortcuts = (shortcuts: ShortcutHandler[]) => {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (isInputElement(document.activeElement)) {
        // Allow Escape to work even in input fields
        if (event.key !== 'Escape') {
          return;
        }
      }

      for (const shortcut of shortcuts) {
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = shortcut.ctrlKey ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const shiftMatches = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;
        const altMatches = shortcut.altKey ? event.altKey : !event.altKey;

        if (keyMatches && ctrlMatches && shiftMatches && altMatches) {
          event.preventDefault();
          shortcut.handler();
          return;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
};

// Export common shortcuts list for documentation
export const KEYBOARD_SHORTCUTS = [
  { key: 'n', description: 'Create new lead' },
  { key: '/', description: 'Focus search' },
  { key: 'Escape', description: 'Close dialog / Clear search' },
] as const;
