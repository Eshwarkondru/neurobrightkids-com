ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS model_version text,
  ADD COLUMN IF NOT EXISTS threshold_version text,
  ADD COLUMN IF NOT EXISTS inference_engine text;