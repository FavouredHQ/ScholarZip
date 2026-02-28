import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import heroBg from "@/assets/hero-bg.jpg";
import {
  Sparkles,
  GraduationCap,
  Target,
  Shield,
  ArrowRight,
  CheckCircle2,
  Globe,
  Zap,
  BarChart3,
  Users,
} from "lucide-react";

const stats = [
  { value: "5,000+", label: "Global Funds Indexed", icon: Globe },
  { value: "98%", label: "Match Accuracy", icon: Target },
  { value: "$2.4B", label: "Scholarships Listed", icon: BarChart3 },
  { value: "50K+", label: "Students Matched", icon: Users },
];

const steps = [
  { icon: GraduationCap, title: "Build Your Profile", desc: "Education level, country of origin, target destinations—our AI needs just 60 seconds of your time.", step: "01" },
  { icon: Zap, title: "AI Scouts Match You", desc: "Our agents scan thousands of funds daily, scoring each one against your unique academic fingerprint.", step: "02" },
  { icon: CheckCircle2, title: "Apply & Win", desc: "Apply directly through ScholarFlow. Track every application status in one clean dashboard.", step: "03" },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden pt-16">
        <div className="absolute inset-0 z-0">
          <img src={heroBg} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/70 to-background" />
        </div>
        <div className="relative z-10 container flex flex-col items-center text-center py-28 md:py-40 lg:py-48">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent mb-6 animate-fade-in opacity-0">
            <Sparkles className="h-4 w-4" />
            AI-Powered · 5,000+ Funds Indexed Daily
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground max-w-4xl leading-[1.1] animate-fade-in opacity-0">
            The World's Scholarships,{" "}
            <span className="text-gradient-gold">Matched to You.</span>
          </h1>

          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed animate-fade-in opacity-0" style={{ animationDelay: "0.15s" }}>
            Our AI agents scout 5,000+ global funds daily. Stop searching endlessly—let the money find you.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mt-10 animate-fade-in opacity-0" style={{ animationDelay: "0.3s" }}>
            <Button size="lg" className="gradient-gold text-accent-foreground font-semibold shadow-gold text-base px-8 rounded-full hover:opacity-90 transition-opacity" onClick={() => navigate("/scholarships")}>
              Find a Scholarship <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8 rounded-full border-border/60" onClick={() => navigate("/auth?tab=signup")}>
              List a Scholarship
            </Button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border bg-card/50">
        <div className="container py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="flex justify-center mb-2"><s.icon className="h-5 w-5 text-accent" /></div>
                <p className="text-2xl md:text-3xl font-bold text-foreground">{s.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="container py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">Three Steps. Zero Guesswork.</h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">ScholarFlow's AI does the heavy lifting so you can focus on what matters—your education.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((f) => (
            <div key={f.step} className="bg-card rounded-2xl border border-border p-8 shadow-card hover:shadow-card-hover transition-all group">
              <div className="flex items-center gap-3 mb-5">
                <span className="text-4xl font-bold text-accent/20">{f.step}</span>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl gradient-gold group-hover:shadow-gold transition-shadow">
                  <f.icon className="h-5 w-5 text-accent-foreground" />
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Providers */}
      <section className="gradient-navy py-24">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold gradient-gold text-accent-foreground mb-4">For Providers</span>
              <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">Reach the Right Students, Instantly</h2>
              <p className="text-primary-foreground/70 mb-8 text-lg">Post your scholarships and let our AI match them with the most qualified candidates worldwide.</p>
              <ul className="space-y-3 mb-8">
                {["AI-powered candidate matching", "Real-time application tracking", "Reach students across 120+ countries"].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-primary-foreground/80">
                    <Shield className="h-5 w-5 text-accent flex-shrink-0" />{item}
                  </li>
                ))}
              </ul>
              <Button size="lg" className="gradient-gold text-accent-foreground font-semibold shadow-gold rounded-full hover:opacity-90 transition-opacity" onClick={() => navigate("/auth?tab=signup")}>
                Start as Provider <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
            <div className="flex justify-center">
              <div className="relative w-72 h-72 rounded-2xl border border-accent/20 flex items-center justify-center animate-float bg-accent/5">
                <GraduationCap className="h-24 w-24 text-accent opacity-50" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-24">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Ready to Let the Money Find You?</h2>
          <p className="text-muted-foreground mb-8 text-lg">Join thousands of students already matched with life-changing scholarships.</p>
          <Button size="lg" className="gradient-gold text-accent-foreground font-semibold shadow-gold text-base px-10 rounded-full hover:opacity-90 transition-opacity" onClick={() => navigate("/auth?tab=signup")}>
            Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background py-10">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-lg font-bold text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-gold">
              <GraduationCap className="h-4 w-4 text-accent-foreground" />
            </div>
            ScholarFlow
          </div>
          <p className="text-sm text-muted-foreground">© 2026 ScholarFlow. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
