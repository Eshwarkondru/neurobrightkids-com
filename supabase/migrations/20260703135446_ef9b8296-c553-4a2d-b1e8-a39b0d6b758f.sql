-- Allow authenticated users to check their own roles via has_role
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Tighten child_profiles: only parent/teacher/special_educator can create/manage
DROP POLICY IF EXISTS "Users can manage their own child profiles" ON public.child_profiles;

CREATE POLICY "Owners can view their own child profiles"
ON public.child_profiles FOR SELECT TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "Only parents/teachers/educators can create child profiles"
ON public.child_profiles FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = owner_id AND (
    public.has_role(auth.uid(), 'parent'::public.app_role)
    OR public.has_role(auth.uid(), 'teacher'::public.app_role)
    OR public.has_role(auth.uid(), 'special_educator'::public.app_role)
  )
);

CREATE POLICY "Owners can update their own child profiles"
ON public.child_profiles FOR UPDATE TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their own child profiles"
ON public.child_profiles FOR DELETE TO authenticated
USING (auth.uid() = owner_id);

-- Enforce game_sessions.child_profile_id ownership at DB level
CREATE OR REPLACE FUNCTION public.enforce_game_session_child_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.child_profile_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.child_profiles
      WHERE id = NEW.child_profile_id
        AND owner_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'child_profile_id must belong to the session user';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_game_session_child_owner_trg ON public.game_sessions;
CREATE TRIGGER enforce_game_session_child_owner_trg
BEFORE INSERT OR UPDATE ON public.game_sessions
FOR EACH ROW EXECUTE FUNCTION public.enforce_game_session_child_owner();