import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Privileged roles (parent / teacher / special_educator) can NEVER be granted on
// the caller's word alone: RLS only allows self-assigning 'child', and this
// server function additionally requires a valid, unused, unexpired invite code
// issued by an admin in public.role_invites that matches the requested role.
// A code is consumed (bound to the caller) atomically before the role is granted.
export const assignPrivilegedRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      role: z.enum(["parent", "teacher", "special_educator"]),
      inviteCode: z.string().trim().min(4).max(64),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    if (existingError) {
      console.error("assignPrivilegedRole: lookup failed", existingError);
      throw new Error("Could not verify your account");
    }

    // A child account must never hold a privileged role.
    if (existing?.some((r) => r.role === "child")) {
      throw new Error("This account cannot be given adult permissions");
    }

    if (existing?.some((r) => r.role === data.role)) {
      return { ok: true, alreadyAssigned: true };
    }

    const code = data.inviteCode.trim().toUpperCase();
    const nowIso = new Date().toISOString();

    // Atomically claim the invite: only succeeds if it matches the requested
    // role, is unused, and is not expired.
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from("role_invites")
      .update({ used_by: context.userId, used_at: nowIso })
      .eq("code", code)
      .eq("role", data.role)
      .is("used_by", null)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .select("id")
      .maybeSingle();

    if (claimError) {
      console.error("assignPrivilegedRole: invite claim failed", claimError);
      throw new Error("Could not verify your access code");
    }

    if (!claimed) {
      throw new Error("Invalid, expired, or already-used access code");
    }

    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: data.role });

    if (error) {
      console.error("assignPrivilegedRole: insert failed", error);
      // Release the invite so it is not silently burned.
      await supabaseAdmin
        .from("role_invites")
        .update({ used_by: null, used_at: null })
        .eq("id", claimed.id);
      throw new Error("Could not assign role");
    }

    return { ok: true, alreadyAssigned: false };
  });
