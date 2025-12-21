/**
 * Keyboard shortcuts utility
 */

export type KeyboardShortcut = {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
};

export function setupKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  if (typeof window === 'undefined') return () => {};

  const handleKeyDown = (e: KeyboardEvent) => {
    shortcuts.forEach((shortcut) => {
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = shortcut.ctrl ? e.ctrlKey : !e.ctrlKey;
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
      const altMatch = shortcut.alt ? e.altKey : !e.altKey;
      const metaMatch = shortcut.meta ? e.metaKey : !e.metaKey;

      // Don't trigger if user is typing in an input/textarea
      const isInputFocused = 
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable);

      if (
        keyMatch &&
        ctrlMatch &&
        shiftMatch &&
        altMatch &&
        metaMatch &&
        !isInputFocused
      ) {
        e.preventDefault();
        shortcut.action();
      }
    });
  };

  window.addEventListener('keydown', handleKeyDown);

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
}

// Common shortcuts
export const COMMON_SHORTCUTS = {
  SEARCH: { key: 'k', ctrl: true, description: 'Focus search' },
  ESCAPE: { key: 'Escape', description: 'Close modals' },
};

