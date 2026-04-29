import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Profile } from '@/types';

const CACHE_KEY = ['profiles-cache'];
const STALE_MS = 5 * 60 * 1000; // 5분

interface CacheEntry {
  profile: Profile;
  fetchedAt: number;
}

type Cache = Record<string, CacheEntry>;

// 동시 요청 디듀프용 in-flight 맵
const inflight = new Map<string, Promise<void>>();

/**
 * 전역 React Query 캐시를 사용하는 프로필 훅.
 * - 모든 컴포넌트가 동일한 캐시를 공유 → 중복 fetch 제거
 * - 5분 TTL 후 stale된 ID만 재요청
 * - 동시 요청 자동 디듀프
 */
export function useProfiles() {
  const qc = useQueryClient();
  const [, force] = useState(0);
  const subscribedRef = useRef(false);

  // 캐시 변경 구독 (다른 컴포넌트가 새 프로필을 추가하면 리렌더)
  useEffect(() => {
    if (subscribedRef.current) return;
    subscribedRef.current = true;
    const unsub = qc.getQueryCache().subscribe((event) => {
      if (event?.query?.queryKey?.[0] === 'profiles-cache') {
        force((n) => n + 1);
      }
    });
    return () => { unsub(); subscribedRef.current = false; };
  }, [qc]);

  const getCache = (): Cache => qc.getQueryData<Cache>(CACHE_KEY) || {};

  const profiles = useMemo<Record<string, Profile>>(() => {
    const cache = getCache();
    const out: Record<string, Profile> = {};
    Object.keys(cache).forEach((id) => { out[id] = cache[id].profile; });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc.getQueryData(CACHE_KEY)]);

  const fetchProfiles = useCallback(async (ids: string[]) => {
    const uniqueIds = [...new Set(ids)].filter(Boolean);
    if (uniqueIds.length === 0) return;

    const cache = getCache();
    const now = Date.now();
    const stale = uniqueIds.filter((id) => {
      const entry = cache[id];
      return !entry || now - entry.fetchedAt > STALE_MS;
    });
    // 이미 in-flight인 ID 제외
    const toFetch = stale.filter((id) => !inflight.has(id));
    if (toFetch.length === 0) {
      // 진행 중 요청들 기다리기
      await Promise.all(stale.map((id) => inflight.get(id)).filter(Boolean) as Promise<void>[]);
      return;
    }

    const promise = (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, email')
        .in('id', toFetch);

      const fetchedAt = Date.now();
      qc.setQueryData<Cache>(CACHE_KEY, (prev) => {
        const next: Cache = { ...(prev || {}) };
        (data || []).forEach((p: any) => {
          next[p.id] = { profile: p, fetchedAt };
        });
        return next;
      });
    })();

    toFetch.forEach((id) => inflight.set(id, promise));
    try {
      await promise;
    } finally {
      toFetch.forEach((id) => inflight.delete(id));
    }
  }, [qc]);

  return { profiles, fetchProfiles };
}
