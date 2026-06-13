import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { SiteLayout, PageHero } from "@/components/site/Layout";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact — NeuroLearn AI" }, { name: "description", content: "Talk to our team about pilots, partnerships or school deployments." }] }),
  component: Contact,
});

function Contact() {
  const [sending, setSending] = useState(false);
  return (
    <SiteLayout>
      <PageHero eyebrow="Contact" title="Let's talk" subtitle="Pilots, partnerships, research collaborations — we'd love to hear from you." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="glass-strong rounded-3xl p-6 lg:col-span-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSending(true);
              setTimeout(() => { setSending(false); toast.success("Message sent! We'll be in touch shortly."); (e.target as HTMLFormElement).reset(); }, 700);
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div className="space-y-1.5"><Label htmlFor="name">Name</Label><Input id="name" required placeholder="Jane Doe" /></div>
            <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" required placeholder="jane@school.org" /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="org">Organization</Label><Input id="org" placeholder="Riverside Elementary" /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="msg">Message</Label><Textarea id="msg" rows={5} required placeholder="Tell us about your needs..." /></div>
            <div className="sm:col-span-2"><Button type="submit" variant="hero" size="lg" disabled={sending}><Send className="h-4 w-4" /> {sending ? "Sending..." : "Send message"}</Button></div>
          </form>
        </div>
        <div className="space-y-4">
          {[
            { icon: Mail, t: "Email", v: "hello@neurolearn.ai" },
            { icon: Phone, t: "Phone", v: "+1 (555) 010-2026" },
            { icon: MapPin, t: "HQ", v: "Bengaluru · Remote-first" },
            { icon: MessageCircle, t: "Support", v: "Mon – Fri, 9am – 6pm" },
          ].map((c)=>(
            <div key={c.t} className="glass-strong flex items-center gap-3 rounded-2xl p-4">
              <div className="gradient-bg flex h-10 w-10 items-center justify-center rounded-2xl text-primary-foreground shadow-glow"><c.icon className="h-5 w-5" /></div>
              <div><div className="text-xs text-muted-foreground">{c.t}</div><div className="text-sm font-semibold">{c.v}</div></div>
            </div>
          ))}
        </div>
      </div>
    </SiteLayout>
  );
}
