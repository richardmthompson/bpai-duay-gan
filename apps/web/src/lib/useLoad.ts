"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

interface State<T> {
  key: string;
  data: T | null;
  error: unknown;
}

/** Loads on mount and whenever deps change; reload() refetches without blanking the screen. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const key = JSON.stringify(deps);
  const [state, setState] = useState<State<T>>({ key, data: null, error: null });
  const fnRef = useRef(fn);
  const keyRef = useRef(key);
  useLayoutEffect(() => {
    fnRef.current = fn;
    keyRef.current = key;
  });

  const reload = useCallback(async () => {
    const k = keyRef.current;
    try {
      const data = await fnRef.current();
      setState((s) => (keyRef.current === k ? { key: k, data, error: null } : s));
      return data;
    } catch (error) {
      setState((s) => (keyRef.current === k ? { key: k, data: s.key === k ? s.data : null, error } : s));
      return null;
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [key, reload]);

  // Data from a previous key is never shown for the current one.
  const current = state.key === key;
  const data = current ? state.data : null;
  const error = current ? state.error : null;

  const setData = useCallback((update: (cur: T | null) => T | null) => {
    setState((s) => ({ ...s, data: update(s.data) }));
  }, []);

  return { data, error, loading: data === null && !error, reload, setData };
}
