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
