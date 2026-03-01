import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import { GraduationCap, Building2 } from "lucide-react";

const Auth = () => {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [selectingRole, setSelectingRole] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user && role) {
      navigate(role === "provider" ? "/provider" : "/dashboard");
    } else if (user && !role) {
      setSelectingRole(true);
    }
  }, [user, role, loading, navigate]);

  const handleSocialLogin = async (provider: "google" | "apple") => {
    const { error } = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin + "/auth",
    });
    if (error) toast.error(error.message);
  };

  const handleRoleSelect = async (selectedRole: "student" | "provider") => {
    if (!user) return;
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: user.id, role: selectedRole });
    if (error) {
      toast.error("Failed to set role. Please try again.");
      return;
    }
    toast.success(selectedRole === "student" ? "Welcome, student!" : "Welcome, provider!");
    // Force role refresh by reloading
    window.location.href = selectedRole === "provider" ? "/provider" : "/dashboard";
  };

  if (loading) return null;

  // Step 3: Role selection
  if (selectingRole && user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center pt-24 pb-12 px-4">
          <Card className="w-full max-w-md shadow-card animate-fade-in">
            <CardHeader className="text-center">
              <CardTitle className="font-display text-2xl">How will you use ScholarFlow?</CardTitle>
              <CardDescription>Choose your role to get started</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleRoleSelect("student")}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border bg-card hover:border-primary hover:bg-accent transition-all text-center group"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <GraduationCap className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Student</p>
                  <p className="text-xs text-muted-foreground mt-1">Find & apply for scholarships</p>
                </div>
              </button>
              <button
                onClick={() => handleRoleSelect("provider")}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border bg-card hover:border-primary hover:bg-accent transition-all text-center group"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Building2 className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Scholarship Provider</p>
                  <p className="text-xs text-muted-foreground mt-1">List & manage scholarships</p>
                </div>
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Steps 1 & 2: Social login
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex items-center justify-center pt-24 pb-12 px-4">
        <Card className="w-full max-w-sm shadow-card animate-fade-in">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-2xl">Welcome to ScholarFlow</CardTitle>
            <CardDescription>The world's scholarships, matched to you</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full gap-2 text-sm h-11" onClick={() => handleSocialLogin("google")}>
              <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continue with Google
            </Button>
            <Button variant="outline" className="w-full gap-2 text-sm h-11" onClick={() => handleSocialLogin("apple")}>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
              Continue with Apple
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
