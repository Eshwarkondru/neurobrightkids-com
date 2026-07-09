CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL,
  child_profile_id uuid REFERENCES public.child_profiles(id) ON DELETE SET NULL,
  child_name text NOT NULL,
  child_age integer,
  child_grade text,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  scores jsonb NOT NULL DEFAULT '[]'::jsonb,
  highest_disorder text,
  highest_percent integer,
  risk_level text,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  therapist jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_games jsonb NOT NULL DEFAULT '[]'::jsonb,
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  weaknesses jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_correct integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents manage their own reports"
ON public.reports
FOR ALL
TO authenticated
USING (auth.uid() = parent_id)
WITH CHECK (auth.uid() = parent_id);

CREATE OR REPLACE FUNCTION public.enforce_report_child_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.child_profile_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.child_profiles
      WHERE id = NEW.child_profile_id AND owner_id = NEW.parent_id
    ) THEN
      RAISE EXCEPTION 'child_profile_id must belong to the parent';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_report_child_owner() FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS trg_enforce_report_child_owner ON public.reports;
CREATE TRIGGER trg_enforce_report_child_owner
BEFORE INSERT OR UPDATE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.enforce_report_child_owner();

DROP TRIGGER IF EXISTS trg_reports_updated_at ON public.reports;
CREATE TRIGGER trg_reports_updated_at
BEFORE UPDATE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS reports_parent_id_created_at_idx
  ON public.reports (parent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_child_profile_id_idx
  ON public.reports (child_profile_id);