import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Member {
  id: string;
  worker_id: string;
  status: string;
  created_at: string;
  display_name: string | null;
  email: string;
}

interface Admin {
  id: string;
  admin_id: string;
  display_name: string | null;
  email: string;
  custom_role: string | null;
}

interface Invitation {
  id: string;
  email: string;
  status: string;
  created_at: string;
  expires_at: string;
}

export type { Member, Admin, Invitation as MemberInvitation };

export function useMembersData(projectId: string | undefined) {
  return useQuery({
    queryKey: ['members', projectId],
    queryFn: async () => {
      const [membersRes, adminsRes, invitationsRes] = await Promise.all([
        supabase.from('project_memberships').select('*').eq('project_id', projectId!).eq('status', 'ACTIVE'),
        supabase.from('project_admins').select('*').eq('project_id', projectId!),
        supabase.from('project_invitations').select('*').eq('project_id', projectId!).order('created_at', { ascending: false }),
      ]);

      const workerIds = (membersRes.data || []).map((m: any) => m.worker_id);
      const adminIds = (adminsRes.data || []).map((a: any) => a.admin_id);
      const allIds = [...new Set([...workerIds, ...adminIds])];

      let profileMap: Record<string, { display_name: string | null; email: string }> = {};
      if (allIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, display_name, email').in('id', allIds);
        (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });
      }

      const members: Member[] = (membersRes.data || []).map((m: any) => ({
        ...m,
        display_name: profileMap[m.worker_id]?.display_name || null,
        email: profileMap[m.worker_id]?.email || m.worker_id,
      }));

      const admins: Admin[] = (adminsRes.data || []).map((a: any) => ({
        id: a.id,
        admin_id: a.admin_id,
        display_name: profileMap[a.admin_id]?.display_name || null,
        email: profileMap[a.admin_id]?.email || a.admin_id,
        custom_role: a.custom_role || null,
      }));

      const invitations: Invitation[] = (invitationsRes.data || []) as Invitation[];

      return { members, admins, invitations };
    },
    enabled: !!projectId,
  });
}
