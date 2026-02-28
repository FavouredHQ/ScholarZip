import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import heroBg from "@/assets/hero-bg.jpg";
import { Sparkles, GraduationCap, Target, Shield, ArrowRight, CheckCircle2 } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden pt-16">
        <div className="absolute inset-0 z-0">
          <img src={heroBg} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/60 to-background" />
        </div>
        <div className="relative z-10 container flex flex-col items-center text-center py-32 md:py-44">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent mb-6 animate-fade-in opacity-0">
            <Sparkles className="h-4 w-4" />
            AI-Powered Scholarship Matching
          </div>
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold text-foreground max-w-4xl leading-tight animate-fade-in opacity-0">
            Find Your Perfect{" "}
            <span className="text-gradient-gold">Scholarship</span>{" "}
            Match
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl animate-fade-in opacity-0" style={{ animationDelay: "0.2s" }}>
            ScholarMatch uses artificial intelligence to connect students with the best scholarship opportunities worldwide. Stop searching, start matching.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mt-10 animate-fade-in opacity-0" style={{ animationDelay: "0.4s" }}>
            <Button
              size="lg"
              className="gradient-gold text-accent-foreground font-semibold shadow-gold text-base px-8 hover:opacity-90 transition-opacity"
              onClick={() => navigate("/auth?tab=signup")}
            >
              Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-base px-8"
              onClick={() => navigate("/scholarships")}
            >
              Browse Scholarships
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container py-24">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
            How ScholarMatch Works
          </h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            Three simple steps to find scholarships tailored to your unique profile
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: GraduationCap,
              title: "Build Your Profile",
              desc: "Tell us about your education, goals, and interests. The more we know, the better your matches.",
              step: "01",
            },
            {
              icon: Target,
              title: "AI Matching",
              desc: "Our AI analyzes thousands of scholarships and scores each one against your unique profile.",
              step: "02",
            },
            {
              icon: CheckCircle2,
              title: "Apply & Win",
              desc: "Apply to your top matches directly through the platform. Track your applications in one place.",
              step: "03",
            },
          ].map((feature) => (
            <Card key={feature.step} className="shadow-card hover:shadow-card-hover transition-all group border-0 bg-card">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-display text-3xl font-bold text-accent/30">{feature.step}</span>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl gradient-gold group-hover:shadow-gold transition-shadow">
                    <feature.icon className="h-5 w-5 text-accent-foreground" />
                  </div>
                </div>
                <h3 className="font-display text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* For Providers */}
      <section className="gradient-navy py-24">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="gradient-gold text-accent-foreground font-semibold mb-4">For Providers</Badge>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
                Reach the Right Students
              </h2>
              <p className="text-primary-foreground/70 mb-8 text-lg">
                Post your scholarships and let our AI match them with the most qualified candidates automatically.
              </p>
              <ul className="space-y-3 mb-8">
                {["AI-powered candidate matching", "Application tracking dashboard", "Reach students worldwide"].map(item => (
                  <li key={item} className="flex items-center gap-3 text-primary-foreground/80">
                    <Shield className="h-5 w-5 text-accent flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button
                size="lg"
                className="gradient-gold text-accent-foreground font-semibold shadow-gold hover:opacity-90 transition-opacity"
                onClick={() => navigate("/auth?tab=signup")}
              >
                Start as Provider <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
            <div className="flex justify-center">
              <div className="relative w-72 h-72 rounded-2xl gradient-gold/10 border border-accent/20 flex items-center justify-center animate-float">
                <GraduationCap className="h-24 w-24 text-accent opacity-60" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background py-10">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-gold">
              <GraduationCap className="h-4 w-4 text-accent-foreground" />
            </div>
            ScholarMatch
          </div>
          <p className="text-sm text-muted-foreground">© 2026 ScholarMatch. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

const Badge = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${className}`}>
    {children}
  </span>
);

export default Index;
