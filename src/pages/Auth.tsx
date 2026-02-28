import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraduationCap, Briefcase } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") === "signup" ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState<"student" | "provider">("student");
  const [submitting, setSubmitting] = useState(false);
  const { user, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && role) {
      navigate(role === "provider" ? "/provider" : "/dashboard");
    }
  }, [user, role, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Welcome back!");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }

    if (data.user) {
      // Insert user role
      await supabase.from("user_roles").insert({ user_id: data.user.id, role: selectedRole });
    }

    setSubmitting(false);
    toast.success("Check your email to confirm your account!");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex items-center justify-center pt-24 pb-12 px-4">
        <Card className="w-full max-w-md shadow-card animate-fade-in">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-2xl">Welcome to ScholarMatch</CardTitle>
            <CardDescription>Find your perfect scholarship match with AI</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input id="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full gradient-gold text-accent-foreground font-semibold shadow-gold" disabled={submitting}>
                    {submitting ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input id="signup-name" value={fullName} onChange={e => setFullName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input id="signup-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                  </div>
                  <div className="space-y-2">
                    <Label>I am a...</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedRole("student")}
                        className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all ${
                          selectedRole === "student"
                            ? "border-accent bg-accent/10 shadow-gold"
                            : "border-border hover:border-accent/50"
                        }`}
                      >
                        <GraduationCap className="h-6 w-6 text-accent" />
                        <span className="text-sm font-medium">Student</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedRole("provider")}
                        className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all ${
                          selectedRole === "provider"
                            ? "border-accent bg-accent/10 shadow-gold"
                            : "border-border hover:border-accent/50"
                        }`}
                      >
                        <Briefcase className="h-6 w-6 text-accent" />
                        <span className="text-sm font-medium">Provider</span>
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full gradient-gold text-accent-foreground font-semibold shadow-gold" disabled={submitting}>
                    {submitting ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
