import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Brain, CheckCircle2, Eye, EyeOff, Gamepad2, GraduationCap, LogIn, LogOut, Mail, ShieldCheck, Sparkles, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SiteLayout, PageHero } from "@/components/site/Layout";
import { supabase } from "@/integrations/supabase/client";
import { assignPrivilegedRole } from "@/lib/api/roles.functions";
import { lovable } from "@/integrations/lovable";
import type { Enums, Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s.next === "string" ? { next: s.next } : {},

  head: () => ({
    meta: [
      { title: "Login — NeuroLearn AI" },
      { name: "description", content: "Sign in or create child, parent, teacher, and special educator accounts for NeuroLearn AI." },
    ],
  }),
  component: AuthPage,
});

// Only allow same-origin relative paths as post-login redirect targets.
function safeNext(next: string | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

type AppRole = Enums<"app_role">;
type Profile = Tables<"profiles">;
type ChildProfile = Tables<"child_profiles">;

const roleLabels: Record<AppRole, string> = {
  child: "Child",
  parent: "Parent",
  teacher: "Teacher",
  special_educator: "Special Educator",
  admin: "Admin",
};

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("signin");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [activeChild, setActiveChild] = useState<string | null>(null);

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("parent");
  const [organization, setOrganization] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState("8");
  const [childGrade, setChildGrade] = useState("3");

  const canCreateChild = useMemo(() => role === "parent" || role === "teacher" || role === "special_educator", [role]);

  useEffect(() => {
    void loadAccount();
    const { data } = supabase.auth.onAuthStateChange(() => {
      void loadAccount();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function loadAccount() {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    setSessionEmail(user?.email ?? null);
    if (!user) {
      setProfile(null);
      setRole(null);
      setChildren([]);
      setActiveChild(null);
      return;
    }

    // If arrived here from the OAuth consent flow, bounce back once signed in.
    if (typeof window !== "undefined") {
      const nextParam = safeNext(new URLSearchParams(window.location.search).get("next") ?? undefined);
      if (nextParam) {
        window.location.replace(nextParam);
        return;
      }
    }

    const [{ data: profileData }, { data: roleData }, { data: childData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id).limit(1).maybeSingle(),
      supabase.from("child_profiles").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
    ]);

    setProfile(profileData ?? null);
    setRole(roleData?.role ?? null);
    const list = childData ?? [];
    setChildren(list);
    const savedChild = typeof window !== "undefined" ? localStorage.getItem("neurolearn_active_child") : null;
    const nextActive = list.find((child) => child.id === savedChild)?.id ?? list[0]?.id ?? null;
    setActiveChild(nextActive);
    if (nextActive) localStorage.setItem("neurolearn_active_child", nextActive);
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: signInEmail.trim(), password: signInPassword });
    setLoading(false);
    if (error) {
      console.error("signIn failed", error);
      toast.error("Invalid email or password.");
      return;
    }
    toast.success("Logged in successfully");
    const nextParam = safeNext(new URLSearchParams(window.location.search).get("next") ?? undefined);
    if (nextParam) {
      window.location.href = nextParam;
      return;
    }
    await navigate({ to: "/games" });
  }

  async function handleGoogle() {
    setLoading(true);
    const nextParam = safeNext(new URLSearchParams(window.location.search).get("next") ?? undefined);
    const redirectPath = nextParam ?? "/auth";
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}${redirectPath}` });
    setLoading(false);
    if (result.error) {
      console.error("google oauth failed", result.error);
      toast.error("Google sign-in failed. Please try again.");
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (selectedRole !== "child" && inviteCode.trim().length < 4) {
      toast.error("An adult access code from your school or admin is required for this role.");
      return;
    }


    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim(), role: selectedRole } },
    });
    if (error) {
      setLoading(false);
      console.error("signUp failed", error);
      toast.error("Could not create account. Please try again.");
      return;
    }

    const userId = data.user?.id;
    if (userId) {
      const profilePayload = {
        user_id: userId,
        display_name: name.trim() || email.trim().split("@")[0],
        email: email.trim(),
        organization: organization.trim() || null,
      };
      const { error: profileError } = await supabase.from("profiles").upsert(profilePayload, { onConflict: "user_id" });
      let roleError: unknown = null;
      if (selectedRole === "child") {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: selectedRole });
        roleError = error;
      } else if (selectedRole === "parent" || selectedRole === "teacher" || selectedRole === "special_educator") {
        try {
          await assignPrivilegedRole({ data: { role: selectedRole, inviteCode: inviteCode.trim() } });
        } catch (err) {
          roleError = err;
        }
      }

      if (selectedRole === "child" && childName.trim()) {
        const { data: newChild } = await supabase.from("child_profiles").insert({
          owner_id: userId,
          child_name: childName.trim(),
          age: Number(childAge),
          grade: childGrade.trim() || null,
        }).select("id").maybeSingle();
        if (newChild?.id) localStorage.setItem("neurolearn_active_child", newChild.id);
      }
      if (profileError || roleError) {
        console.error("profile/role setup failed", { profileError, roleError });
        toast.error(
          roleError && selectedRole !== "child"
            ? "Account created, but the access code was not accepted. Ask your school or admin for a valid code."
            : "Profile setup failed. Please try again.",
        );
      }

    }

    setLoading(false);
    toast.success("Account created. You can now play games and save progress.");
    const nextParam = safeNext(new URLSearchParams(window.location.search).get("next") ?? undefined);
    if (nextParam) {
      window.location.href = nextParam;
      return;
    }
    await navigate({ to: selectedRole === "child" ? "/games" : "/parent" });
  }

  async function handleCreateChild(e: React.FormEvent) {
    e.preventDefault();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      toast.error("Please login first.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("child_profiles").insert({
      owner_id: data.user.id,
      child_name: childName.trim(),
      age: Number(childAge),
      grade: childGrade.trim() || null,
    });
    setLoading(false);
    if (error) {
      console.error("child_profile insert failed", error);
      toast.error("Could not add child profile. Please try again.");
      return;
    }
    toast.success("Child profile added");
    setChildName("");
    await loadAccount();
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    localStorage.removeItem("neurolearn_active_child");
    toast.success("Signed out");
  }

  function chooseChild(id: string) {
    setActiveChild(id);
    localStorage.setItem("neurolearn_active_child", id);
    toast.success("Child selected for games");
  }

  return (
    <SiteLayout>
      <PageHero eyebrow="Secure login" title="Child, parent & teacher accounts" subtitle="Use email as the username and a password. Children can login directly, or parents can add child profiles and select one before games." />

      {sessionEmail ? (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="glass-strong rounded-3xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="gradient-bg flex h-12 w-12 items-center justify-center rounded-2xl text-primary-foreground shadow-glow">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">You are logged in</h2>
                  <p className="text-sm text-muted-foreground">{profile?.display_name || sessionEmail} · {role ? roleLabels[role] : "Account"}</p>
                </div>
              </div>
              <Button variant="glass" onClick={handleSignOut}><LogOut className="h-4 w-4" /> Logout</Button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <InfoCard icon={Mail} label="Username" value={sessionEmail} />
              <InfoCard icon={Users} label="Role" value={role ? roleLabels[role] : "Not set"} />
              <InfoCard icon={Gamepad2} label="Saved children" value={`${children.length}`} />
            </div>

            <div className="mt-6 rounded-2xl bg-secondary/40 p-4 text-sm text-muted-foreground">
              <b className="text-foreground">Child login:</b> create a Child account on this page with the child's email/username and password. For younger children, login as Parent, add a child profile below, then tap Play Games.
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/games"><Button variant="hero"><Gamepad2 className="h-4 w-4" /> Play Games</Button></Link>
              <Link to="/dashboard"><Button variant="glass">Open Dashboard</Button></Link>
              <Link to="/reports"><Button variant="glass">View Reports</Button></Link>
            </div>
          </section>

          <section className="glass-strong rounded-3xl p-6">
            <h2 className="text-lg font-bold">Child profiles</h2>
            <p className="mt-1 text-sm text-muted-foreground">Select the child whose games should be saved.</p>

            <div className="mt-4 space-y-3">
              {children.length === 0 ? (
                <div className="rounded-2xl bg-secondary/40 p-4 text-sm text-muted-foreground">No child profile yet. Add one below.</div>
              ) : children.map((child) => (
                <button key={child.id} onClick={() => chooseChild(child.id)} className={`w-full rounded-2xl border p-4 text-left transition hover:bg-secondary/50 ${activeChild === child.id ? "border-primary bg-primary/10" : "border-border/60 bg-secondary/30"}`}>
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{child.child_name}</div>
                    {activeChild === child.id && <CheckCircle2 className="h-4 w-4 text-success" />}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Age {child.age} · Grade {child.grade || "Not set"}</div>
                </button>
              ))}
            </div>

            {canCreateChild && (
              <form onSubmit={handleCreateChild} className="mt-5 space-y-3 rounded-2xl border border-border/60 p-4">
                <div className="text-sm font-semibold">Add child profile</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Child name"><Input value={childName} onChange={(e) => setChildName(e.target.value)} placeholder="Aarav" required /></Field>
                  <Field label="Age"><Input type="number" min="3" max="18" value={childAge} onChange={(e) => setChildAge(e.target.value)} required /></Field>
                  <Field label="Grade"><Input value={childGrade} onChange={(e) => setChildGrade(e.target.value)} placeholder="3" /></Field>
                </div>
                <Button disabled={loading} type="submit" variant="hero" size="sm"><UserPlus className="h-4 w-4" /> Add Child</Button>
              </form>
            )}
          </section>
        </div>
      ) : (
        <div className="mx-auto max-w-xl">


          <section className="glass-strong rounded-3xl p-6">
            <Tabs value={mode} onValueChange={setMode}>
              <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl p-1">
                <TabsTrigger value="signin" className="rounded-xl py-2">Sign In</TabsTrigger>
                <TabsTrigger value="signup" className="rounded-xl py-2">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-5">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <Field label="Username / Email"><Input type="email" value={signInEmail} onChange={(e) => setSignInEmail(e.target.value)} placeholder="child@example.com" required /></Field>
                  <PasswordField label="Password" value={signInPassword} onChange={setSignInPassword} show={showPassword} setShow={setShowPassword} />
                  <Button disabled={loading} type="submit" variant="hero" className="w-full"><LogIn className="h-4 w-4" /> Login</Button>
                </form>
                <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" /></div>
                <Button disabled={loading} variant="glass" className="w-full" onClick={handleGoogle}><Sparkles className="h-4 w-4" /> Continue with Google</Button>
              </TabsContent>

              <TabsContent value="signup" className="mt-5">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Full name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Child / Parent name" required /></Field>
                    <Field label="Role">
                      <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="child">Child</SelectItem>
                          <SelectItem value="parent">Parent</SelectItem>
                          <SelectItem value="teacher">Teacher</SelectItem>
                          <SelectItem value="special_educator">Special Educator</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Username / Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="child@example.com" required /></Field>
                    <PasswordField label="Create password" value={password} onChange={setPassword} show={showPassword} setShow={setShowPassword} />
                    <Field label="School / organization"><Input value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="Optional" /></Field>
                    {selectedRole === "child" && <Field label="Child profile name"><Input value={childName} onChange={(e) => setChildName(e.target.value)} placeholder="Aarav" /></Field>}
                    {selectedRole !== "child" && (
                      <Field label="Adult access code">
                        <Input
                          value={inviteCode}
                          onChange={(e) => setInviteCode(e.target.value)}
                          placeholder="Provided by your school or admin"
                          required
                        />
                      </Field>
                    )}

                  </div>
                  {selectedRole === "child" && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Age"><Input type="number" min="3" max="18" value={childAge} onChange={(e) => setChildAge(e.target.value)} /></Field>
                      <Field label="Grade"><Input value={childGrade} onChange={(e) => setChildGrade(e.target.value)} /></Field>
                    </div>
                  )}
                  <Button disabled={loading} type="submit" variant="hero" className="w-full"><UserPlus className="h-4 w-4" /> Create Account</Button>
                </form>
              </TabsContent>
            </Tabs>
          </section>
        </div>
      )}
    </SiteLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function PasswordField({ label, value, onChange, show, setShow }: { label: string; value: string; onChange: (value: string) => void; show: boolean; setShow: (value: boolean) => void }) {
  return (
    <Field label={label}>
      <div className="relative">
        <Input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Minimum 6 characters" required minLength={6} className="pr-10" />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={show ? "Hide password" : "Show password"}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </Field>
  );
}

function Step({ icon: Icon, title, text }: { icon: typeof UserPlus; title: string; text: string }) {
  return <div className="flex gap-3 rounded-2xl bg-secondary/50 p-3"><Icon className="mt-0.5 h-4 w-4 text-primary" /><div><div className="font-semibold">{title}</div><div className="text-muted-foreground">{text}</div></div></div>;
}

function InfoCard({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return <div className="glass rounded-2xl p-4"><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"><Icon className="h-3.5 w-3.5 text-primary" /> {label}</div><div className="mt-2 truncate font-semibold">{value}</div></div>;
}
