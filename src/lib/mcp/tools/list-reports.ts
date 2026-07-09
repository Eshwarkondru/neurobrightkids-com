import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_reports",
  title: "List assessment reports",
  description:
    "List assessment reports for the signed-in user. Optionally filter by child_profile_id.",
  inputSchema: {
    child_profile_id: z.string().uuid().optional().describe("Optional child profile ID to filter reports by."),
    limit: z.number().int().optional().describe("Maximum number of reports to return (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ child_profile_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let query = supabaseForUser(ctx)
      .from("reports")
      .select("id, created_at, child_profile_id, child_name, child_age, child_grade, highest_disorder, highest_percent, risk_level, total_correct, total_questions")
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit ?? 25, 1), 100));
    if (child_profile_id) query = query.eq("child_profile_id", child_profile_id);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { reports: data ?? [] },
    };
  },
});
