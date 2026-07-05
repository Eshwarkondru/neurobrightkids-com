
-- 1) Enforce game_sessions child_profile ownership via trigger
DROP TRIGGER IF EXISTS trg_enforce_game_session_child_owner ON public.game_sessions;
CREATE TRIGGER trg_enforce_game_session_child_owner
BEFORE INSERT OR UPDATE ON public.game_sessions
FOR EACH ROW EXECUTE FUNCTION public.enforce_game_session_child_owner();

-- 2) Prevent role self-assignment bypass: a user cannot combine 'child' with privileged roles
CREATE OR REPLACE FUNCTION public.enforce_role_exclusivity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_child boolean;
  has_privileged boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'child') INTO has_child;
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role IN ('parent','teacher','special_educator','admin')) INTO has_privileged;

  IF NEW.role = 'child' AND has_privileged THEN
    RAISE EXCEPTION 'child role cannot be combined with privileged roles';
  END IF;
  IF NEW.role IN ('parent','teacher','special_educator') AND has_child THEN
    RAISE EXCEPTION 'privileged roles cannot be combined with child role';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_role_exclusivity ON public.user_roles;
CREATE TRIGGER trg_enforce_role_exclusivity
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_role_exclusivity();

-- 3) Move has_role out of API-exposed public schema
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO postgres, service_role;

-- Recreate the child_profiles INSERT policy to reference private.has_role
DROP POLICY IF EXISTS "Only parents/teachers/educators can create child profiles" ON public.child_profiles;
CREATE POLICY "Only parents/teachers/educators can create child profiles"
ON public.child_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = owner_id AND (
    private.has_role(auth.uid(), 'parent'::public.app_role)
    OR private.has_role(auth.uid(), 'teacher'::public.app_role)
    OR private.has_role(auth.uid(), 'special_educator'::public.app_role)
  )
);

-- Drop the public.has_role function now that it's replaced
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
