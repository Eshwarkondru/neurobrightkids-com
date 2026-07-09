import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Privileged roles cannot be self-assigned via RLS (policy only allows 'child').
// This server function inserts a privileged role for the authenticated caller
// through the admin client. It is auth-gated (requireSupabaseAuth) and refuses
// to grant 'admin'. Additional verification (invite codes, email domain checks)
// can be layered in here later without changing the client contract.
export const assignPrivilegedRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      role: z.enum(["parent", "teacher", "special_educator"]),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Prevent duplicate/conflicting privileged rows for the same user.
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    if (existingError) {
      console.error("assignPrivilegedRole: lookup failed", existingError);
      throw new Error("Could not assign role");
    }

    if (existing?.some((r) => r.role === data.role)) {
      return { ok: true, alreadyAssigned: true };
    }

    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: data.role });

    if (error) {
      console.error("assignPrivilegedRole: insert failed", error);
      throw new Error("Could not assign role");
    }

    return { ok: true, alreadyAssigned: false };
  });
