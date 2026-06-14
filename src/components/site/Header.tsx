import { Link } from "@tanstack/react-router";
import { Brain, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";

const nav = [
  { to: "/", label: "Home" },
  { to: "/assessment", label: "Assessment" },
  { to: "/games", label: "Games" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/reports", label: "Reports" },
  { to: "/parent", label: "Parent" },
  { to: "/teacher", label: "Teacher" },
  { to: "/research", label: "Research" },
  { to: "/contact", label: "Contact" },
  { to: "/install", label: "Get the App" },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="mx-auto max-w-7xl px-4 pt-4">
        <div className="glass-strong flex items-center justify-between rounded-2xl px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="gradient-bg flex h-9 w-9 items-center justify-center rounded-xl shadow-glow">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-tight">NeuroLearn AI</div>
              <div className="text-[10px] text-muted-foreground">Adaptive Screening</div>
            </div>
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground whitespace-nowrap"
                activeProps={{ className: "bg-secondary text-foreground" }}
                activeOptions={{ exact: n.to === "/" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/assessment" className="hidden sm:block">
              <Button variant="hero" size="sm">Start Assessment</Button>
            </Link>
            <Button variant="glass" size="icon" className="lg:hidden rounded-full" onClick={() => setOpen(!open)} aria-label="Menu">
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        {open && (
          <div className="glass-strong mt-2 rounded-2xl p-3 lg:hidden">
            <div className="grid grid-cols-2 gap-1">
              {nav.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                  activeProps={{ className: "bg-secondary text-foreground" }}
                >
                  {n.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
