import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  DollarSign,
  Calendar,
  Search,
  GraduationCap,
  Bookmark,
  BookmarkCheck,
  Clock,
  Filter,
  ExternalLink,
  X,
  Radar,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

const EDU_LEVELS = ["All", "High School", "Undergraduate", "Graduate", "Masters", "PhD", "Postdoc"];

const daysLeft = (deadline: string | null) => {
  if (!deadline) return null;
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
};

const formatCurrency = (amount: number | null, currency: string | null) => {
  if (!amount) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: 0 }).format(amount);
};

const Scholarships = () => {
  const { user } = useAuth();
  const [scholarships, setScholarships] = useState<Tables<"scholarships">[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Tables<"scholarships"> | null>(null);

  // Filters
  const [eduFilter, setEduFilter] = useState("All");
  const [amountRange, setAmountRange] = useState([0]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [schRes, savedRes] = await Promise.all([
        supabase.from("scholarships").select("*").eq("is_active", true).order("created_at", { ascending: false }),
        user
          ? supabase.from("saved_scholarships").select("scholarship_id").eq("user_id", user.id)
          : Promise.resolve({ data: [] }),
      ]);
      setScholarships(schRes.data ?? []);
      setSavedIds(new Set((savedRes.data ?? []).map((s: any) => s.scholarship_id)));
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const maxAmount = useMemo(
    () => Math.max(...scholarships.map((s) => Number(s.amount) || 0), 0),
    [scholarships]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return scholarships.filter((s) => {
      const matchesSearch =
        !q ||
        s.title.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.tags?.some((t) => t.toLowerCase().includes(q));

      const matchesEdu =
        eduFilter === "All" ||
        s.tags?.some((t) => t.toLowerCase() === eduFilter.toLowerCase()) ||
        (s.eligibility_criteria as any)?.education_level === eduFilter;

      const matchesAmount = amountRange[0] === 0 || (Number(s.amount) || 0) >= amountRange[0];

      return matchesSearch && matchesEdu && matchesAmount;
    });
  }, [scholarships, search, eduFilter, amountRange]);

  const handleSave = async (scholarshipId: string) => {
    if (!user) {
      toast.error("Please sign in to save scholarships");
      return;
    }
    setSavingId(scholarshipId);
    const isSaved = savedIds.has(scholarshipId);

    if (isSaved) {
      await supabase.from("saved_scholarships").delete().eq("user_id", user.id).eq("scholarship_id", scholarshipId);
      setSavedIds((prev) => { const n = new Set(prev); n.delete(scholarshipId); return n; });
      toast.success("Removed from saved");
    } else {
      const { error } = await supabase.from("saved_scholarships").insert({ user_id: user.id, scholarship_id: scholarshipId });
      if (error) toast.error(error.message);
      else {
        setSavedIds((prev) => new Set(prev).add(scholarshipId));
        toast.success("Saved for later!");
      }
    }
    setSavingId(null);
  };

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
      setSelected(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container pt-24 pb-12">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="font-display text-3xl font-bold text-foreground">Scholarship Discovery</h1>
          <p className="text-muted-foreground mt-1">Browse and filter opportunities from providers worldwide</p>
        </div>

        {/* Search + Filter Toggle */}
        <div className="flex gap-3 mb-6 animate-fade-in">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Search by title, description, or tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
          </Button>
        </div>

        <div className="flex gap-6">
          {/* Filter Sidebar */}
          {showFilters && (
            <aside className="w-64 shrink-0 space-y-6 animate-slide-in-right hidden md:block">
              <Card className="shadow-card">
                <CardContent className="pt-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-semibold text-sm">Filters</h3>
                    <button
                      onClick={() => { setEduFilter("All"); setAmountRange([0]); }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Reset
                    </button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Education Level</Label>
                    <Select value={eduFilter} onValueChange={setEduFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EDU_LEVELS.map((l) => (
                          <SelectItem key={l} value={l}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs text-muted-foreground">
                      Minimum Amount: {amountRange[0] === 0 ? "Any" : formatCurrency(amountRange[0], "USD")}
                    </Label>
                    <Slider
                      value={amountRange}
                      onValueChange={setAmountRange}
                      max={maxAmount || 100000}
                      step={500}
                    />
                  </div>
                </CardContent>
              </Card>
            </aside>
          )}

          {/* Mobile Filters */}
          {showFilters && (
            <div className="md:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm" onClick={() => setShowFilters(false)}>
              <div className="absolute bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-semibold">Filters</h3>
                  <button onClick={() => setShowFilters(false)}><X className="h-5 w-5" /></button>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Education Level</Label>
                  <Select value={eduFilter} onValueChange={setEduFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EDU_LEVELS.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label className="text-xs text-muted-foreground">
                    Min Amount: {amountRange[0] === 0 ? "Any" : formatCurrency(amountRange[0], "USD")}
                  </Label>
                  <Slider value={amountRange} onValueChange={setAmountRange} max={maxAmount || 100000} step={500} />
                </div>
                <Button className="w-full" onClick={() => setShowFilters(false)}>Apply Filters</Button>
              </div>
            </div>
          )}

          {/* Scholarship Grid */}
          <div className="flex-1">
            {loading ? (
              <div className="text-center py-16 text-muted-foreground animate-pulse">Loading scholarships...</div>
            ) : filtered.length === 0 ? (
              <Card className="shadow-card">
                <CardContent className="py-20 text-center text-muted-foreground">
                  <Radar className="h-14 w-14 mx-auto mb-4 text-accent opacity-40 animate-pulse" />
                  <p className="text-lg font-display font-semibold text-foreground mb-1">
                    Our AI Scouts are currently indexing new grants.
                  </p>
                  <p className="text-sm">Check back in 5 minutes!</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4">{filtered.length} scholarship{filtered.length !== 1 ? "s" : ""} found</p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-fade-in">
                  {filtered.map((s) => {
                    const days = daysLeft(s.deadline);
                    const isSaved = savedIds.has(s.id);
                    return (
                      <Card
                        key={s.id}
                        className="shadow-card hover:shadow-card-hover transition-all group cursor-pointer"
                        onClick={() => setSelected(s)}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-lg font-display group-hover:text-accent transition-colors line-clamp-2">
                              {s.title}
                            </CardTitle>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSave(s.id); }}
                              disabled={savingId === s.id}
                              className="shrink-0 p-1 hover:bg-muted rounded-md transition-colors"
                            >
                              {isSaved ? (
                                <BookmarkCheck className="h-5 w-5 text-accent" />
                              ) : (
                                <Bookmark className="h-5 w-5 text-muted-foreground" />
                              )}
                            </button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm text-muted-foreground line-clamp-2">{s.description}</p>
                          <div className="flex items-center gap-4 text-sm">
                            {s.amount && (
                              <span className="flex items-center gap-1 font-semibold text-foreground">
                                <DollarSign className="h-4 w-4 text-accent" />
                                {formatCurrency(s.amount, s.currency)}
                              </span>
                            )}
                            {days !== null && (
                              <span className={`flex items-center gap-1 ${days <= 7 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                                <Clock className="h-4 w-4" />
                                {days <= 0 ? "Expired" : `${days}d left`}
                              </span>
                            )}
                          </div>
                          {s.tags && s.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {s.tags.slice(0, 4).map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                              ))}
                              {s.tags.length > 4 && (
                                <Badge variant="outline" className="text-xs">+{s.tags.length - 4}</Badge>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl">{selected.title}</DialogTitle>
                <DialogDescription className="sr-only">Scholarship details</DialogDescription>
              </DialogHeader>
              <div className="space-y-5 mt-2">
                <div className="flex items-center gap-4 text-sm">
                  {selected.amount && (
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      <DollarSign className="h-4 w-4 text-accent" />
                      {formatCurrency(selected.amount, selected.currency)}
                    </span>
                  )}
                  {selected.deadline && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {new Date(selected.deadline).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                    </span>
                  )}
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {selected.description || "No description provided."}
                </p>

                {selected.eligibility_criteria && (
                  <div>
                    <h4 className="font-display font-semibold text-sm mb-2">Eligibility</h4>
                    <pre className="text-xs bg-muted rounded-lg p-3 overflow-x-auto text-muted-foreground">
                      {JSON.stringify(selected.eligibility_criteria, null, 2)}
                    </pre>
                  </div>
                )}

                {selected.tags && selected.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selected.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                )}

                {selected.source_url && (
                  <a
                    href={selected.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-accent hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="h-4 w-4" /> View Original Source
                  </a>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => handleSave(selected.id)}
                  >
                    {savedIds.has(selected.id) ? (
                      <><BookmarkCheck className="h-4 w-4" /> Saved</>
                    ) : (
                      <><Bookmark className="h-4 w-4" /> Save for Later</>
                    )}
                  </Button>
                  <Button
                    className="flex-1 gradient-gold text-accent-foreground font-semibold shadow-gold hover:opacity-90 transition-opacity"
                    onClick={() => handleApply(selected.id)}
                  >
                    Apply Now
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Scholarships;
