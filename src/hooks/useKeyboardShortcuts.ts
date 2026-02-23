import { useEffect } from 'react';

interface ShortcutMap {
  undo: () => void;
  redo: () => void;
  exportSingle: () => void;
  exportBulk: () => void;
  toggleEditor: () => void;
}

function isTextInput(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return type === 'text' || type === 'search' || type === 'url' || type === 'email' || type === 'number' || type === 'password';
  }
  return el.isContentEditable;
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      // Let browser handle Ctrl+Z/Y natively in text fields
      if (isTextInput(e.target)) {
        // Only intercept Ctrl+S (export) and Ctrl+E (toggle) inside text inputs
        if (e.key === 's' && !e.shiftKey) {
          e.preventDefault();
          shortcuts.exportSingle();
        } else if (e.key === 's' && e.shiftKey) {
          e.preventDefault();
          shortcuts.exportBulk();
        } else if (e.key === 'e') {
          e.preventDefault();
          shortcuts.toggleEditor();
        }
        return;
      }

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        shortcuts.undo();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        shortcuts.redo();
      } else if (e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        shortcuts.exportSingle();
      } else if (e.key === 's' && e.shiftKey) {
        e.preventDefault();
        shortcuts.exportBulk();
      } else if (e.key === 'e') {
        e.preventDefault();
        shortcuts.toggleEditor();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts]);
}
