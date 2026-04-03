import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Project, Invitation } from '@/types';

interface ProjectsData {
  projects: Project[];
  memberCounts: Record<string, number>;
  joinedProjectIds: Set<string>;
  invitations: Invitation[];
}

export function useProjectsData(userId: string | undefined, role: string | null) {
  return useQuery<ProjectsData>({
    queryKey: ['projects', userId, role],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      let items = (data || []) as Project[];
      if (!error && role !== 'admin') {
        items = items.filter(p => p.status === 'ACTIVE');
      }

      let memberCounts: Record<string, number> = {};
      let joinedProjectIds = new Set<string>();

      if (items.length > 0) {
        const ids = items.map(p => p.id);
        const [membersRes, adminsRes] = await Promise.all([
          supabase.from('project_memberships').select('project_id, worker_id').eq('status', 'ACTIVE').in('project_id', ids),
          supabase.from('project_admins').select('project_id, admin_id').in('project_id', ids),
        ]);

        ids.forEach(id => {
          const memberUserIds = new Set(
            (membersRes.data || []).filter((r: any) => r.project_id === id).map((r: any) => r.worker_id)
          );
          (adminsRes.data || []).filter((r: any) => r.project_id === id).forEach((r: any) => memberUserIds.add(r.admin_id));
          memberCounts[id] = memberUserIds.size;
        });

        if (role === 'admin' && userId) {
          joinedProjectIds = new Set(
            (adminsRes.data || []).filter((r: any) => r.admin_id === userId).map((r: any) => r.project_id)
          );
        }
      }

      // Fetch invitations
      const { data: profileData } = await supabase.from('profiles').select('email').eq('id', userId!).single();
      const userEmail = profileData?.email?.toLowerCase();

      let invitations: Invitation[] = [];
      if (userEmail) {
        const { data: invData } = await supabase
          .rpc('get_my_pending_invitations');

        if (invData && invData.length > 0) {
          const projectIds = [...new Set(invData.map((inv: any) => inv.project_id))];
          const { data: projData } = await supabase.rpc('get_invitation_project_names', { _project_ids: projectIds });
          const projMap: Record<string, string> = {};
          (projData || []).forEach((p: any) => { projMap[p.id] = p.name; });

          invitations = invData.map((inv: any) => ({
            ...inv,
            project_name: projMap[inv.project_id] || '알 수 없는 프로젝트',
          }));
        }
      }

      return { projects: items, memberCounts, joinedProjectIds, invitations };
    },
    enabled: !!userId && role !== null,
  });
}
