import { createFileRoute } from "@tanstack/react-router";
import { BookOpenCheck, Brain, ChartBar, FlaskConical, Lightbulb, ShieldCheck, Sparkles } from "lucide-react";
import { SiteLayout, PageHero } from "@/components/site/Layout";

export const Route = createFileRoute("/research")({
  head: () => ({ meta: [{ title: "About Research — NeuroLearn AI" }, { name: "description", content: "The science and AI architecture behind NeuroLearn." }] }),
  component: Research,
});

const pillars = [
  { icon: Brain, t: "Neural Networks", d: "A trained MLP reads accuracy, response timing and error counts, not just the answer." },
  { icon: ChartBar, t: "Behavioral Analytics", d: "Latency, hesitation, stroke dynamics and self-correction as cognitive signals." },
  { icon: Sparkles, t: "Adaptive Learning", d: "Item Response Theory + bandit policies tune content to the zone of proximal development." },
  { icon: Lightbulb, t: "Explainable AI", d: "SHAP-style attributions surface why a prediction was made, in plain language." },
  { icon: FlaskConical, t: "Multi-Disorder Screening", d: "Joint modelling across Dyslexia, Dysgraphia, Dyscalculia & ADHD reduces false positives." },
  { icon: ShieldCheck, t: "Privacy First", d: "On-device feature extraction where possible; aggregated, de-identified analytics." },
];

function Research() {
  return (
    <SiteLayout>
      <PageHero eyebrow="About the research" title="Science you can show your principal" subtitle="An honest look at the modelling choices, data design, and clinical guardrails behind the platform." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pillars.map((p)=>(
          <div key={p.t} className="glass-strong rounded-3xl p-6">
            <div className="gradient-bg mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl text-primary-foreground shadow-glow"><p.icon className="h-5 w-5" /></div>
            <div className="text-base font-bold">{p.t}</div>
            <p className="mt-2 text-sm text-muted-foreground">{p.d}</p>
          </div>
        ))}
      </div>
      <section className="mt-10 glass-strong rounded-3xl p-8">
        <div className="flex items-center gap-3"><BookOpenCheck className="h-5 w-5 text-primary" /><h2 className="text-xl font-bold">Position statement</h2></div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          NeuroLearn AI is a <b>screening and learning support</b> system — not a clinical diagnostic device.
          Predictions are designed to flag patterns worth a closer look by qualified educators or clinicians,
          and to guide age-appropriate, evidence-aligned practice. We follow COPPA, FERPA and GDPR-K principles
          for children's data.
        </p>
      </section>
    </SiteLayout>
  );
}
