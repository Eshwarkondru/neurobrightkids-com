import { Link } from "@tanstack/react-router";
import { Brain, Github, Mail, Twitter } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border/60">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2">
              <div className="gradient-bg flex h-9 w-9 items-center justify-center rounded-xl shadow-glow">
                <Brain className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-base font-bold">NeuroLearn AI</span>
            </div>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              Transformer-assisted adaptive learning & multi-disorder screening platform for
              children. Built with care, science, and explainable AI.
            </p>
            <div className="mt-4 flex gap-2">
              <a className="glass rounded-full p-2 hover:scale-105 transition" href="#" aria-label="Twitter"><Twitter className="h-4 w-4" /></a>
              <a className="glass rounded-full p-2 hover:scale-105 transition" href="#" aria-label="GitHub"><Github className="h-4 w-4" /></a>
              <a className="glass rounded-full p-2 hover:scale-105 transition" href="mailto:hello@neurolearn.ai" aria-label="Email"><Mail className="h-4 w-4" /></a>
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold">Platform</div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/assessment" className="hover:text-foreground">Assessment</Link></li>
              <li><Link to="/games" className="hover:text-foreground">Games</Link></li>
              <li><Link to="/dashboard" className="hover:text-foreground">Dashboard</Link></li>
              <li><Link to="/reports" className="hover:text-foreground">Reports</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-sm font-semibold">For</div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/parent" className="hover:text-foreground">Parents</Link></li>
              <li><Link to="/teacher" className="hover:text-foreground">Teachers</Link></li>
              <li><Link to="/research" className="hover:text-foreground">Researchers</Link></li>
              <li><Link to="/contact" className="hover:text-foreground">Contact</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <div>© {new Date().getFullYear()} NeuroLearn AI. For research & educational use.</div>
          <div>Made with explainable AI · Privacy-first · COPPA-aware</div>
        </div>
      </div>
    </footer>
  );
}
