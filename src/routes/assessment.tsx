import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SiteLayout, PageHero } from "@/components/site/Layout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { ASSESSMENT_QUESTIONS, applyModelRisks, computeAssessment, severityColor, type AssessmentResult } from "@/lib/assessment";
import { predictScreeningRisk } from "@/lib/api/predict.functions";

export const Route = createFileRoute("/assessment")({
  head: () => ({ meta: [{ title: "Assessment — NeuroLearn AI" }, { name: "description", content: "Adaptive multi-disorder screening assessment for children." }] }),
  component: Assessment,
});

function Assessment() {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [times, setTimes] = useState<number[]>([]);
  const [startedAt] = useState(() => Date.now());
  const [questionShownAt, setQuestionShownAt] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [modelInfo, setModelInfo] = useState<{ version: string; engine: string } | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const predict = useServerFn(predictScreeningRisk);
  const total = ASSESSMENT_QUESTIONS.length;
  const done = i >= total;
  const progress = useMemo(() => (i / total) * 100, [i, total]);

  const select = (idx: number) => {
    const elapsed = Math.min(120, Math.max(0.2, (Date.now() - questionShownAt) / 1000));
    setTimes((prev) => [...prev, elapsed]);
    setAnswers((prev) => [...prev, idx]);
    setQuestionShownAt(Date.now());
    setI((prev) => prev + 1);
  };

  useEffect(() => {
    if (!done || saved || saving) return;
    setSaving(true);
    setModelError(null);
    void (async () => {
      const base = computeAssessment(answers);
      const accOf = (d: string) => {
        const r = base.results.find((x) => x.disorder === d);
        return r && r.total > 0 ? r.correct / r.total : 0;
      };
      const wrong = (id: string) => {
        const idx = ASSESSMENT_QUESTIONS.findIndex((q) => q.id === id);
        return idx >= 0 && answers[idx] !== ASSESSMENT_QUESTIONS[idx]?.answer ? 1 : 0;
      };

      // Real behavioral feature extraction from this session's interactions.
      const rt = times.length ? times : [6];
      const avg = rt.reduce((a, b) => a + b, 0) / rt.length;
      const variance = rt.reduce((a, b) => a + (b - avg) ** 2, 0) / rt.length;
      const telemetry = {
        age: 11,
        accuracy_overall: base.totalQuestions ? base.totalCorrect / base.totalQuestions : 0,
        reading_accuracy: accOf("dyslexia"),
        attention_accuracy: accOf("adhd"),
        math_accuracy: accOf("dyscalculia"),
        memory_score: accOf("memory"),
        response_time_avg: Math.round(avg * 100) / 100,
        response_time_var: Math.round(Math.min(10000, variance) * 100) / 100,
        spelling_errors: wrong("d3") + wrong("d1"),
        mirror_letter_errors: wrong("d2"),
        // Slow, hesitant answers act as the retry/hesitation signal in a
        // single-attempt quiz (games supply true retries).
        retry_frequency: Math.round(Math.min(2, Math.max(0, (avg - 4) / 6)) * 100) / 100,
        task_completion: answers.length / base.totalQuestions,
        engagement_min: Math.round(((Date.now() - startedAt) / 60000) * 100) / 100,
      };

      // Assessment -> feature extraction -> deep-learning model -> risk scores.
      let computed = base;
      try {
        const pred = await predict({ data: telemetry });
        computed = applyModelRisks(base, {
          dyslexia: pred.risks.dyslexia,
          adhd: pred.risks.adhd,
          dyscalculia: pred.risks.dyscalculia,
        });
        setModelInfo({ version: pred.modelVersion, engine: pred.engine });
      } catch (err) {
        console.error("neural-network prediction failed", err);
        setModelInfo(null);
        setModelError(err instanceof Error ? err.message : "The screening model could not be reached.");
        setResult(null);
        setSaving(false);
        return;
      }
      setResult(computed);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.info("Sign in to save your personalized report.");
        setSaved(true); setSaving(false);
        return;
      }
      const userId = userData.user.id;

      // Resolve the active child profile (verified to belong to this parent).
      const candidate = typeof window !== "undefined" ? localStorage.getItem("neurolearn_active_child") : null;
      let childProfile: { id: string; child_name: string; age: number; grade: string | null } | null = null;
      if (candidate) {
        const { data: owned } = await supabase
          .from("child_profiles")
          .select("id, child_name, age, grade")
          .eq("id", candidate)
          .eq("owner_id", userId)
          .maybeSingle();
        childProfile = owned ?? null;
      }
      if (!childProfile) {
        const { data: firstOwned } = await supabase
          .from("child_profiles")
          .select("id, child_name, age, grade")
          .eq("owner_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        childProfile = firstOwned ?? null;
        if (childProfile && typeof window !== "undefined") {
          localStorage.setItem("neurolearn_active_child", childProfile.id);
        }
      }

      // Fall back to the parent's profile display name if no child profile exists.
      let displayChildName = childProfile?.child_name?.trim() ?? "";
      if (!displayChildName) {
        const { data: prof } = await supabase
          .from("profiles").select("display_name").eq("user_id", userId).maybeSingle();
        displayChildName = prof?.display_name?.trim() || (userData.user.email ?? "Child");
      }

      const { error } = await supabase.from("reports").insert({
        parent_id: userId,
        child_profile_id: childProfile?.id ?? null,
        child_name: displayChildName,
        child_age: childProfile?.age ?? null,
        child_grade: childProfile?.grade ?? null,
        answers: answers as unknown as never,
        scores: computed.results as unknown as never,
        highest_disorder: computed.highest.label,
        highest_percent: computed.highest.percent,
        risk_level: computed.highest.severity,
        recommendations: computed.recommendations as unknown as never,
        therapist: computed.therapist as unknown as never,
        recommended_games: computed.recommendedGames as unknown as never,
        strengths: computed.strengths as unknown as never,
        weaknesses: computed.weaknesses as unknown as never,
        total_correct: computed.totalCorrect,
        total_questions: computed.totalQuestions,
      });
      if (error) {
        console.error("reports insert failed", error);
        toast.error("Could not save report. Please try again.");
      } else {
        toast.success("New personalized report saved to your account!");
      }
      setSaved(true); setSaving(false);
    })();
  }, [done, saved, saving, answers]);


  const restart = () => { setI(0); setAnswers([]); setSaved(false); setResult(null); setModelVersion(null); };
  const current = ASSESSMENT_QUESTIONS[i];

  return (
    <SiteLayout>
      <PageHero eyebrow="Adaptive screening" title="Begin your assessment" subtitle="15 short tasks across reading, focus, social, math and memory. Results are calculated instantly." />
      <div className="mx-auto max-w-2xl">
        <div className="glass-strong rounded-3xl p-6 sm:p-8">
          <Progress value={done ? 100 : progress} className="h-2" />
          <div className="mt-2 text-xs text-muted-foreground">Step {Math.min(i + 1, total)} of {total}</div>

          {!done ? (
            <div className="mt-6">
              <div className="text-sm font-semibold text-muted-foreground">{current.title}</div>
              <h2 className="mt-3 text-xl font-bold sm:text-2xl">{current.q}</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {current.options.map((o, idx) => (
                  <button key={o + idx} onClick={() => select(idx)} className="glass rounded-2xl p-4 text-left text-base font-medium transition hover:-translate-y-0.5 hover:bg-card hover:shadow-glow">
                    {o}
                  </button>
                ))}
              </div>
            </div>
          ) : saving || !result ? (
            <div className="mt-8 text-center">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
              <p className="mt-4 text-sm text-muted-foreground">Analyzing responses and generating your personalized report…</p>
            </div>
          ) : (
            <div className="mt-6">
              <div className="text-center">
                <div className="gradient-bg mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-primary-foreground shadow-glow"><CheckCircle2 className="h-7 w-7" /></div>
                <h2 className="mt-4 text-2xl font-bold">Assessment complete</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Highest indicator: <span className="font-semibold" style={{ color: severityColor(result.highest.severity) }}>{result.highest.label} · {result.highest.percent}% · {result.highest.severity}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {modelVersion
                    ? `Scored by the trained risk model (${modelVersion}) on 5,200 hybrid dataset samples`
                    : "Scored with the offline heuristic fallback (model unavailable)"}
                </p>
              </div>
              <div className="mt-6 space-y-3">
                {result.results.map((r) => (
                  <div key={r.disorder}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{r.label}</span>
                      <span className="font-semibold" style={{ color: severityColor(r.severity) }}>{r.percent}% · {r.severity}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full transition-all" style={{ width: `${r.percent}%`, background: severityColor(r.severity) }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link to="/reports"><Button variant="hero" size="lg">View reports <ArrowRight className="h-4 w-4" /></Button></Link>
                <Link to="/games"><Button variant="glass" size="lg">Recommended games</Button></Link>
                <Button variant="glass" size="lg" onClick={restart}>Restart</Button>
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 glass rounded-2xl p-4 text-center text-xs text-muted-foreground">
          <Zap className="mr-1 inline h-3.5 w-3.5 text-primary" /> Screening only — not a clinical diagnosis.
        </div>
      </div>
    </SiteLayout>
  );
}
