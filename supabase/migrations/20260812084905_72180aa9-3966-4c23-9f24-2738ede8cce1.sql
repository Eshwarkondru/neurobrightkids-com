CREATE TABLE public.role_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  role app_role NOT NULL,
  used_by uuid,
  used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.role_invites TO service_role;

ALTER TABLE public.role_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage role invites"
ON public.role_invites FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.role_invites (code, role) VALUES
  ('PARENT-2026-DEMO', 'parent'::app_role),
  ('TEACHER-2026-DEMO', 'teacher'::app_role),
  ('EDUCATOR-2026-DEMO', 'special_educator'::app_role);