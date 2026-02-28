import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DollarSign, Calendar, Search, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

const Scholarships = () => {
  const { user } = useAuth();
  const [scholarships, setScholarships] = useState<Tables<"scholarships">[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("scholarships").select("*").eq("is_active", true).order("created_at", { ascending: false })
      .then(({ data }) => {
        setScholarships(data ?? []);
        setLoading(false);
      });
  }, []);

  const handleApply = async (scholarshipId: string) => {
    if (!user) {
      toast.error("Please sign in to apply");
      return;
    }
    const { error } = await supabase.from("applications").insert({
      student_id: user.id,
      scholarship_id: scholarshipId,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    });
    if (error) {
      if (error.code === "23505") toast.error("You've already applied!");
      else toast.error(error.message);
    } else {
      toast.success("Application submitted!");
    }
  };

  const filtered = scholarships.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.description?.toLowerCase().includes(search.toLowerCase()) ||
    s.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container pt-24 pb-12">
        <div className="mb-8 animate-fade-in">
          <h1 className="font-display text-3xl font-bold text-foreground">Browse Scholarships</h1>
          <p className="text-muted-foreground mt-1">Discover opportunities from providers worldwide</p>
        </div>

        <div className="relative mb-6 animate-fade-in">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Search by title, description, or tags..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground animate-pulse">Loading scholarships...</div>
        ) : filtered.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-16 text-center text-muted-foreground">
              <GraduationCap className="h-12 w-12 mx-auto mb-4 text-accent opacity-50" />
              <p className="text-lg">No scholarships found</p>
              <p className="text-sm mt-1">Try adjusting your search terms</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
            {filtered.map(s => (
              <Card key={s.id} className="shadow-card hover:shadow-card-hover transition-all group">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-display group-hover:text-accent transition-colors">{s.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-3">{s.description}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {s.amount && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" /> {s.currency} {s.amount.toLocaleString()}
                      </span>
                    )}
                    {s.deadline && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" /> {new Date(s.deadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {s.tags && s.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {s.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  )}
                  <Button
                    className="w-full gradient-gold text-accent-foreground font-semibold shadow-gold hover:opacity-90 transition-opacity"
                    onClick={() => handleApply(s.id)}
                  >
                    Apply Now
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Scholarships;
