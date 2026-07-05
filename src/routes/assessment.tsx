import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SiteLayout, PageHero } from "@/components/site/Layout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ASSESSMENT_QUESTIONS, computeAssessment, severityColor, type AssessmentResult } from "@/lib/assessment";

export const Route = createFileRoute("/assessment")({
  head: () => ({ meta: [{ title: "Assessment — NeuroLearn AI" }, { name: "description", content: "Adaptive multi-disorder screening assessment for children." }] }),
  component: Assessment,
});

function Assessment() {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const total = ASSESSMENT_QUESTIONS.length;
  const done = i >= total;
  const progress = useMemo(() => (i / total) * 100, [i, total]);

  const select = (idx: number) => {
    setAnswers((prev) => [...prev, idx]);
    setI((prev) => prev + 1);
  };

  useEffect(() => {
    if (!done || saved || saving) return;
    setSaving(true);
    void (async () => {
      const computed = computeAssessment(answers);
      setResult(computed);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.info("Sign in to save your personalized report.");
        setSaved(true); setSaving(false);
        return;
      }
      const candidate = typeof window !== "undefined" ? localStorage.getItem("neurolearn_active_child") : null;
      let childProfileId: string | null = null;
      if (candidate) {
        const { data: owned } = await supabase
          .from("child_profiles").select("id")
          .eq("id", candidate).eq("owner_id", userData.user.id).maybeSingle();
        childProfileId = owned?.id ?? null;
      }
      const payload = {
        answers,
        scores: computed.results,
        highest: computed.highest,
        strengths: computed.strengths,
        weaknesses: computed.weaknesses,
        recommendations: computed.recommendations,
        therapist: computed.therapist,
        recommendedGames: computed.recommendedGames,
      };
      const { error } = await supabase.from("game_sessions").insert({
        user_id: userData.user.id,
        child_profile_id: childProfileId,
        game_key: "assessment",
        score: computed.totalCorrect,
        rounds: computed.totalQuestions,
        responses: payload as unknown as never,
      });
      if (error) {
        console.error("game_sessions insert failed", error);
        toast.error("Could not save report. Please try again.");
      } else {
        toast.success("New personalized report generated!");
      }
      setSaved(true); setSaving(false);
    })();
  }, [done, saved, saving, answers]);

  const restart = () => { setI(0); setAnswers([]); setSaved(false); setResult(null); };
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
