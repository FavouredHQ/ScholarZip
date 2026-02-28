import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, DollarSign, Calendar, Users, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

const ProviderDashboard = () => {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [scholarships, setScholarships] = useState<Tables<"scholarships">[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [tags, setTags] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
    if (!loading && role === "student") navigate("/dashboard");
  }, [user, role, loading, navigate]);

  const fetchScholarships = async () => {
    if (!user) return;
    const { data } = await supabase.from("scholarships").select("*").eq("provider_id", user.id).order("created_at", { ascending: false });
    setScholarships(data ?? []);
    setLoadingData(false);
  };

  useEffect(() => { fetchScholarships(); }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from("scholarships").insert({
      provider_id: user.id,
      title,
      description,
      amount: amount ? parseFloat(amount) : null,
      deadline: deadline || null,
      tags: tags ? tags.split(",").map(t => t.trim()) : [],
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Scholarship created!");
      setDialogOpen(false);
      setTitle(""); setDescription(""); setAmount(""); setDeadline(""); setTags("");
      fetchScholarships();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("scholarships").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      fetchScholarships();
    }
  };

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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container pt-24 pb-12">
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Provider Dashboard</h1>
            <p className="text-muted-foreground mt-1">Manage your scholarship listings</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-gold text-accent-foreground font-semibold shadow-gold">
                <Plus className="h-4 w-4 mr-2" /> New Scholarship
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display">Create Scholarship</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount (USD)</Label>
                    <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Deadline</Label>
                    <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Tags (comma-separated)</Label>
                  <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="STEM, undergraduate, international" />
                </div>
                <Button type="submit" className="w-full gradient-gold text-accent-foreground font-semibold" disabled={submitting}>
                  {submitting ? "Creating..." : "Create Scholarship"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {scholarships.length === 0 ? (
          <Card className="shadow-card animate-fade-in">
            <CardContent className="py-16 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 text-accent opacity-50" />
              <p className="text-lg mb-2">No scholarships yet</p>
              <p className="text-sm">Create your first scholarship to start matching with students.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
            {scholarships.map(s => (
              <Card key={s.id} className="shadow-card hover:shadow-card-hover transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg font-display">{s.title}</CardTitle>
                    <Badge variant={s.is_active ? "default" : "secondary"}>
                      {s.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-2">{s.description}</p>
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
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(s.id)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
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

export default ProviderDashboard;
