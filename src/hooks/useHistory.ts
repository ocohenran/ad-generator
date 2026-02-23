import { useState, useCallback } from 'react';

// B6 FIX: removed dead skipRef code

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export function useHistory<T>(initial: T, maxHistory = 50) {
  const [state, setState] = useState<HistoryState<T>>({
    past: [],
    present: initial,
    future: [],
  });

  const set = useCallback((newPresent: T | ((prev: T) => T)) => {
    setState((prev) => {
      const resolved = typeof newPresent === 'function'
        ? (newPresent as (prev: T) => T)(prev.present)
        : newPresent;

      return {
        past: [...prev.past.slice(-maxHistory), prev.present],
        present: resolved,
        future: [],
      };
    });
  }, [maxHistory]);

  const undo = useCallback(() => {
    setState((prev) => {
      if (prev.past.length === 0) return prev;
      const newPast = [...prev.past];
      const newPresent = newPast.pop()!;
      return {
        past: newPast,
        present: newPresent,
        future: [prev.present, ...prev.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((prev) => {
      if (prev.future.length === 0) return prev;
      const newFuture = [...prev.future];
      const newPresent = newFuture.shift()!;
      return {
        past: [...prev.past, prev.present],
        present: newPresent,
        future: newFuture,
      };
    });
  }, []);

  // M4/M5 FIX: reset is now wired to a Reset button in the UI
  const reset = useCallback((newPresent: T) => {
    setState({ past: [], present: newPresent, future: [] });
  }, []);

  return {
    state: state.present,
    set,
    undo,
    redo,
    reset,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
