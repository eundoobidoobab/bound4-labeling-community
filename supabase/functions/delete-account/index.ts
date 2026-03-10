import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const userId = user.id;

    // Clean up all user data before deleting auth user
    // Order matters: delete dependent rows first
    await adminClient.from('guide_acknowledgements').delete().eq('user_id', userId);
    await adminClient.from('notice_reads').delete().eq('user_id', userId);
    await adminClient.from('notifications').delete().eq('user_id', userId);
    await adminClient.from('notice_comments').delete().eq('author_id', userId);
    await adminClient.from('comments').delete().eq('author_id', userId);
    await adminClient.from('allocation_applications').delete().eq('worker_id', userId);
    await adminClient.from('allocation_assignments').delete().eq('worker_id', userId);

    // Guide versions: delete dependents first, then versions, then documents
    const { data: guideVersions } = await adminClient.from('guide_versions').select('id, document_id').eq('created_by', userId);
    if (guideVersions && guideVersions.length > 0) {
      const versionIds = guideVersions.map(v => v.id);
      await adminClient.from('guide_acknowledgements').delete().in('guide_version_id', versionIds);
      await adminClient.from('project_latest_guide').delete().in('guide_version_id', versionIds);
      await adminClient.from('guide_versions').delete().eq('created_by', userId);
    }

    // Notices created by user: clean dependents then notices
    const { data: userNotices } = await adminClient.from('notices').select('id').eq('created_by', userId);
    if (userNotices && userNotices.length > 0) {
      const noticeIds = userNotices.map(n => n.id);
      await adminClient.from('notice_attachments').delete().in('notice_id', noticeIds);
      await adminClient.from('notice_comments').delete().in('notice_id', noticeIds);
      await adminClient.from('notice_reads').delete().in('notice_id', noticeIds);
      await adminClient.from('notices').delete().eq('created_by', userId);
    }

    // Posts created by user: clean dependents then posts
    const { data: userPosts } = await adminClient.from('posts').select('id').eq('author_id', userId);
    if (userPosts && userPosts.length > 0) {
      const postIds = userPosts.map(p => p.id);
      await adminClient.from('post_attachments').delete().in('post_id', postIds);
      await adminClient.from('comments').delete().in('post_id', postIds);
      await adminClient.from('posts').delete().eq('author_id', userId);
    }

    // Allocation calls created by user
    const { data: userCalls } = await adminClient.from('allocation_calls').select('id').eq('created_by', userId);
    if (userCalls && userCalls.length > 0) {
      const callIds = userCalls.map(c => c.id);
      await adminClient.from('allocation_applications').delete().in('call_id', callIds);
      await adminClient.from('allocation_assignments').delete().in('call_id', callIds);
      await adminClient.from('allocation_calls').delete().eq('created_by', userId);
    }

    await adminClient.from('project_admins').delete().eq('admin_id', userId);
    await adminClient.from('project_memberships').delete().eq('worker_id', userId);

    // DM: delete attachments for messages sent by user, then messages, then threads
    const { data: threads } = await adminClient.from('dm_threads').select('id').or(`admin_id.eq.${userId},worker_id.eq.${userId}`);
    if (threads && threads.length > 0) {
      const threadIds = threads.map(t => t.id);
      const { data: msgs } = await adminClient.from('dm_messages').select('id').in('thread_id', threadIds);
      if (msgs && msgs.length > 0) {
        await adminClient.from('dm_attachments').delete().in('message_id', msgs.map(m => m.id));
      }
      await adminClient.from('dm_messages').delete().in('thread_id', threadIds);
      await adminClient.from('dm_threads').delete().in('id', threadIds);
    }

    await adminClient.from('user_roles').delete().eq('user_id', userId);
    await adminClient.from('profiles').delete().eq('id', userId);

    // Now delete the auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('Auth delete error:', deleteError);
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error('Delete account error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
