import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Carrega dados ao montar e sempre que `key` muda, com recarga manual e pull-to-refresh.
 * `key` resume as dependências do fetcher (ex.: `${churchId}:${userId}`).
 */
export function useData<T>(fetcher: () => Promise<T>, initial: T, key: string) {
  const [data, setData] = useState<T>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const fetcherRef = useRef(fetcher);
  useLayoutEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    let alive = true;
    fetcherRef.current().then((d) => alive && setData(d));
    return () => { alive = false; };
  }, [key]);

  const reload = useCallback(async () => setData(await fetcherRef.current()), []);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await reload(); } finally { setRefreshing(false); }
  }, [reload]);

  return { data, reload, refresh, refreshing };
}
