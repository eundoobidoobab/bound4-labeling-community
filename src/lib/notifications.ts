import { supabase } from '@/integrations/supabase/client';

/**
 * Get all member IDs (workers + admins) of a project, optionally excluding some user IDs.
 */
export async function getProjectMemberIds(projectId: string, excludeIds: string[] = []): Promise<string[]> {
  const [membersRes, adminsRes] = await Promise.all([
    supabase.from('project_memberships').select('worker_id').eq('project_id', projectId).eq('status', 'ACTIVE'),
    supabase.from('project_admins').select('admin_id').eq('project_id', projectId),
  ]);

  const ids = new Set<string>();
  (membersRes.data || []).forEach((m: any) => ids.add(m.worker_id));
  (adminsRes.data || []).forEach((a: any) => ids.add(a.admin_id));

  excludeIds.forEach(id => ids.delete(id));
  return [...ids];
}

/**
 * Get only admin IDs of a project, optionally excluding some user IDs.
 */
export async function getProjectAdminIds(projectId: string, excludeIds: string[] = []): Promise<string[]> {
  const { data } = await supabase.from('project_admins').select('admin_id').eq('project_id', projectId);
  const ids = (data || []).map((a: any) => a.admin_id).filter((id: string) => !excludeIds.includes(id));
  return ids;
}

/**
 * Send in-app notifications to multiple users.
 */
export async function sendNotifications(params: {
  userIds: string[];
  type: 'ALLOCATION_DISTRIBUTED' | 'DM_NEW_MESSAGE' | 'NOTICE_PUBLISHED' | 'GUIDE_UPDATED';
  title: string;
  body?: string;
  projectId: string;
  deepLink?: string;
}) {
  if (params.userIds.length === 0) return;

  await supabase.rpc('send_project_notifications', {
    _user_ids: params.userIds,
    _type: params.type,
    _title: params.title,
    _body: params.body || null,
    _project_id: params.projectId,
    _deep_link: params.deepLink || null,
  });
}
