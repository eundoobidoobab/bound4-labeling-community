import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Project, Board } from '@/types';

export function useProjectLayout(projectId: string | undefined) {
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId!)
        .single();
      if (error) throw error;
      return data as Project;
    },
    enabled: !!projectId,
  });

  const boardsQuery = useQuery({
    queryKey: ['boards', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('boards')
        .select('*')
        .eq('project_id', projectId!)
        .eq('status', 'ACTIVE')
        .order('order_index');
      if (error) throw error;
      return (data || []) as Board[];
    },
    enabled: !!projectId,
  });

  return {
    project: projectQuery.data ?? null,
    boards: boardsQuery.data ?? [],
    loading: projectQuery.isLoading || boardsQuery.isLoading,
  };
}
