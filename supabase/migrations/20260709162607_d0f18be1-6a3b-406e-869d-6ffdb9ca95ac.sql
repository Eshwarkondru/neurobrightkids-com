DROP POLICY IF EXISTS "Users can create their own non-admin roles" ON public.user_roles;

CREATE POLICY "Users can self-assign only the child role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'child'::app_role);
