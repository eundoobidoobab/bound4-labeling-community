import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Profile } from '@/types';

export function useProfiles() {
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  const fetchProfiles = useCallback(async (ids: string[]) => {
    const uniqueIds = [...new Set(ids)].filter(Boolean);
    if (uniqueIds.length === 0) return;

    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .in('id', uniqueIds);

    if (data) {
      setProfiles(prev => {
        const next = { ...prev };
        data.forEach((p: any) => { next[p.id] = p; });
        return next;
      });
    }
  }, []);

  return { profiles, fetchProfiles };
}
