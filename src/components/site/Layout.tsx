import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="hero-bg min-h-screen">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
      <Footer />
    </div>
  );
}

export function PageHero({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <section className="mb-10 text-center animate-fade-up">
      {eyebrow && (
        <div className="glass mx-auto mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full gradient-bg" /> {eyebrow}
        </div>
      )}
      <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
        <span className="gradient-text">{title}</span>
      </h1>
      {subtitle && <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">{subtitle}</p>}
    </section>
  );
}
