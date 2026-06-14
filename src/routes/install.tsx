import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteLayout, PageHero } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, Monitor, Apple, Download, Share2, Plus, Chrome } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/install")({
  head: () => ({
    meta: [
      { title: "Install NeuroLearn AI — Get the App" },
      { name: "description", content: "Install NeuroLearn AI on your phone, tablet or computer. Works as an installable PWA, Android APK (Capacitor), or Desktop app (Electron)." },
      { property: "og:title", content: "Install NeuroLearn AI" },
      { property: "og:description", content: "Install the NeuroLearn AI app on any device." },
    ],
  }),
  component: InstallPage,
});

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function InstallPage() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop" | "unknown">("unknown");

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) setPlatform("ios");
    else if (/android/.test(ua)) setPlatform("android");
    else setPlatform("desktop");

    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      toast.success("NeuroLearn AI installed!");
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) {
      toast.info("Use your browser menu → 'Install app' or 'Add to Home Screen'.");
      return;
    }
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") toast.success("Installing…");
    setDeferred(null);
  };

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Get the App"
        title="Install NeuroLearn AI"
        subtitle="Use it like a real app — on your phone home screen, tablet, or desktop. Works offline-ready, fullscreen, with its own icon."
      />

      <div className="mx-auto max-w-3xl">
        <Card className="glass-strong border-0 mb-8 animate-fade-up">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <img src="/app-icon-512.png" alt="NeuroLearn AI icon" width={96} height={96} className="rounded-2xl shadow-glow" />
            <div>
              <h2 className="text-xl font-bold">NeuroLearn AI</h2>
              <p className="text-sm text-muted-foreground">Adaptive Learning & Multi-Disorder Screening</p>
            </div>
            {installed ? (
              <div className="rounded-full bg-secondary px-4 py-2 text-sm font-medium">✓ Already installed on this device</div>
            ) : (
              <Button variant="hero" size="lg" onClick={install} className="gap-2">
                <Download className="h-4 w-4" /> Install Now
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              {platform === "ios" && "On iPhone/iPad: tap Share → Add to Home Screen"}
              {platform === "android" && "On Android: tap the Install button above or your browser menu"}
              {platform === "desktop" && "On Desktop: click Install or use the install icon in your address bar"}
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="glass border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Apple className="h-4 w-4" /> iPhone / iPad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>1. Open this page in <b>Safari</b></p>
              <p>2. Tap <Share2 className="inline h-3 w-3" /> Share</p>
              <p>3. Tap <Plus className="inline h-3 w-3" /> Add to Home Screen</p>
              <p>4. Tap <b>Add</b></p>
            </CardContent>
          </Card>

          <Card className="glass border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Smartphone className="h-4 w-4" /> Android</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>1. Open in <b>Chrome</b></p>
              <p>2. Tap the <b>Install</b> button above</p>
              <p>3. Or menu (⋮) → <b>Install app</b></p>
              <p>4. App icon appears on your home screen</p>
            </CardContent>
          </Card>

          <Card className="glass border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Monitor className="h-4 w-4" /> Desktop</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>1. Open in <b>Chrome / Edge</b></p>
              <p>2. Click <Chrome className="inline h-3 w-3" /> install icon in address bar</p>
              <p>3. Or menu → <b>Install NeuroLearn AI</b></p>
              <p>4. Launches like a native app</p>
            </CardContent>
          </Card>
        </div>

        <Card className="glass border-0 mt-8">
          <CardHeader>
            <CardTitle className="text-base">Build a native Android APK (Play Store)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>After publishing your app, wrap it with <b>Capacitor</b> on your local machine to ship a real .apk:</p>
            <pre className="overflow-auto rounded-lg bg-secondary/60 p-3 text-xs"><code>{`npm i -D @capacitor/cli
npm i @capacitor/core @capacitor/android
npx cap init "NeuroLearn AI" com.neurolearn.ai --web-dir=dist
npx cap add android
# point capacitor.config.ts server.url to your published URL
npx cap sync
npx cap open android   # then Build → APK in Android Studio`}</code></pre>
          </CardContent>
        </Card>

        <Card className="glass border-0 mt-4 mb-12">
          <CardHeader>
            <CardTitle className="text-base">Build a Desktop app (Windows / Mac / Linux)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Use <b>Electron</b> to package as .exe / .dmg / .AppImage:</p>
            <pre className="overflow-auto rounded-lg bg-secondary/60 p-3 text-xs"><code>{`npm i -D electron @electron/packager
# set base: './' in vite.config.ts, then:
npm run build
npx @electron/packager . "NeuroLearn AI" --platform=win32 --arch=x64 --out=release`}</code></pre>
            <p className="text-xs">Full guides: <a className="underline" href="https://capacitorjs.com/docs" target="_blank" rel="noreferrer">capacitorjs.com</a> · <a className="underline" href="https://www.electronjs.org/docs" target="_blank" rel="noreferrer">electronjs.org</a></p>
          </CardContent>
        </Card>
      </div>
    </SiteLayout>
  );
}
