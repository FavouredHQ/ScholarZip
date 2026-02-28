import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Calendar, DollarSign, ArrowRight, BookOpen, Trophy, Clock } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Match = Tables<"matches"> & { scholarships: Tables<"scholarships"> | null };
type Application = Tables<"applications"> & { scholarships: Tables<"scholarships"> | null };

const Dashboard = () => {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
    if (!loading && role === "provider") navigate("/provider");
  }, [user, role, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [matchRes, appRes] = await Promise.all([
        supabase.from("matches").select("*, scholarships(*)").eq("student_id", user.id).order("match_score", { ascending: false }),
        supabase.from("applications").select("*, scholarships(*)").eq("student_id", user.id).order("created_at", { ascending: false }),
      ]);
      setMatches((matchRes.data as Match[]) ?? []);
      setApplications((appRes.data as Application[]) ?? []);
      setLoadingData(false);
    };
    fetchData();
  }, [user]);

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container pt-24 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    submitted: "bg-accent/20 text-accent-foreground",
    under_review: "bg-accent/30 text-accent-foreground",
    accepted: "bg-success/20 text-success",
    rejected: "bg-destructive/20 text-destructive",
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container pt-24 pb-12">
        <div className="mb-8 animate-fade-in">
          <h1 className="font-display text-3xl font-bold text-foreground">Student Dashboard</h1>
          <p className="text-muted-foreground mt-1">Your AI-matched scholarships and applications</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 animate-fade-in">
          <Card className="shadow-card">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-gold">
                <Sparkles className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">AI Matches</p>
                <p className="text-2xl font-display font-bold">{matches.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
                <BookOpen className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Applications</p>
                <p className="text-2xl font-display font-bold">{applications.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/20">
                <Trophy className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Accepted</p>
                <p className="text-2xl font-display font-bold">
                  {applications.filter(a => a.status === "accepted").length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Matches */}
        <section className="mb-10">
          <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" /> AI-Matched Scholarships
          </h2>
          {matches.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Sparkles className="h-10 w-10 mx-auto mb-3 text-accent opacity-50" />
                <p>No matches yet. Complete your profile to get AI-powered scholarship matches!</p>
                <Button variant="outline" className="mt-4" onClick={() => navigate("/profile")}>
                  Complete Profile
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {matches.map(match => (
                <Card key={match.id} className="shadow-card hover:shadow-card-hover transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg font-display">{match.scholarships?.title}</CardTitle>
                      <Badge className="gradient-gold text-accent-foreground font-semibold">
                        {Math.round((match.match_score ?? 0) * 100)}% Match
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-2">{match.scholarships?.description}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {match.scholarships?.amount && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          {match.scholarships.currency} {match.scholarships.amount.toLocaleString()}
                        </span>
                      )}
                      {match.scholarships?.deadline && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(match.scholarships.deadline).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {match.ai_reasoning && (
                      <p className="text-xs text-muted-foreground italic bg-muted/50 rounded-lg p-2">
                        💡 {match.ai_reasoning}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Applications */}
        <section>
          <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Your Applications
          </h2>
          {applications.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="py-12 text-center text-muted-foreground">
                <BookOpen className="h-10 w-10 mx-auto mb-3 text-primary opacity-50" />
                <p>No applications yet. Browse scholarships to get started!</p>
                <Button variant="outline" className="mt-4" onClick={() => navigate("/scholarships")}>
                  Browse Scholarships
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {applications.map(app => (
                <Card key={app.id} className="shadow-card hover:shadow-card-hover transition-shadow">
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex-1">
                      <h3 className="font-display font-semibold">{app.scholarships?.title}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <Badge className={statusColor[app.status ?? "draft"]}>
                          {app.status?.replace("_", " ")}
                        </Badge>
                        {app.submitted_at && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(app.submitted_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
