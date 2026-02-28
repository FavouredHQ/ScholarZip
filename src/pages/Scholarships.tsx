import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  DollarSign,
  Calendar,
  Search,
  GraduationCap,
  Bookmark,
  BookmarkCheck,
  Clock,
  ExternalLink,
  Radar,
  Rocket,
  FlaskConical,
  Briefcase,
  BookOpen,
  Heart,
  Globe,
  MapPin,
  User,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

/* ───── constants ───── */
const CATEGORIES = [
  { label: "All", icon: Rocket },
  { label: "Full-Ride", icon: GraduationCap },
  { label: "STEM", icon: FlaskConical },
  { label: "MBA", icon: Briefcase },
  { label: "Humanities", icon: BookOpen },
  { label: "Women in Tech", icon: Heart },
  { label: "Developing Nations", icon: Globe },
];

const CARD_GRADIENTS = [
  "from-navy to-navy-light",
  "from-navy-dark to-navy",
  "from-gold-dark/80 to-gold/60",
  "from-navy-light to-primary",
  "from-navy to-navy-dark",
];

/* ───── helpers ───── */
const daysLeft = (deadline: string | null) => {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / (86400000));
};

const fmtCurrency = (amount: number | null, currency: string | null) => {
  if (!amount) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: 0 }).format(amount);
};

/* ───── component ───── */
const Scholarships = () => {
  const { user } = useAuth();
  const [scholarships, setScholarships] = useState<Tables<"scholarships">[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Tables<"scholarships"> | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const scrollRef = useRef<HTMLDivElement>(null);

  /* fetch */
  useEffect(() => {
    const fetchData = async () => {
      const [schRes, savedRes] = await Promise.all([
        supabase.from("scholarships").select("*").eq("is_active", true).order("created_at", { ascending: false }),
        user ? supabase.from("saved_scholarships").select("scholarship_id").eq("user_id", user.id) : Promise.resolve({ data: [] }),
      ]);
      setScholarships(schRes.data ?? []);
      setSavedIds(new Set((savedRes.data ?? []).map((s: any) => s.scholarship_id)));
      setLoading(false);
    };
    fetchData();
  }, [user]);

  /* filter */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return scholarships.filter((s) => {
      const matchesSearch = !q || s.title.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q) || s.tags?.some((t) => t.toLowerCase().includes(q));
      const matchesCat = activeCategory === "All" || s.tags?.some((t) => t.toLowerCase().includes(activeCategory.toLowerCase()));
      return matchesSearch && matchesCat;
    });
  }, [scholarships, search, activeCategory]);

  /* save / unsave */
  const handleSave = async (scholarshipId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!user) { toast.error("Please sign in to save scholarships"); return; }
    setSavingId(scholarshipId);
    const isSaved = savedIds.has(scholarshipId);
    if (isSaved) {
      await supabase.from("saved_scholarships").delete().eq("user_id", user.id).eq("scholarship_id", scholarshipId);
      setSavedIds((p) => { const n = new Set(p); n.delete(scholarshipId); return n; });
      toast.success("Removed from saved");
    } else {
      const { error } = await supabase.from("saved_scholarships").insert({ user_id: user.id, scholarship_id: scholarshipId });
      if (error) toast.error(error.message);
      else { setSavedIds((p) => new Set(p).add(scholarshipId)); toast.success("Saved for later!"); }
    }
    setSavingId(null);
  };

  /* apply */
  const handleApply = async (scholarshipId: string) => {
    if (!user) { toast.error("Please sign in to apply"); return; }
    const { error } = await supabase.from("applications").insert({ student_id: user.id, scholarship_id: scholarshipId, status: "submitted", submitted_at: new Date().toISOString() });
    if (error) { error.code === "23505" ? toast.error("You've already applied!") : toast.error(error.message); }
    else { toast.success("Application submitted!"); setSelected(null); }
  };

  /* scroll categories */
  const scroll = (dir: number) => scrollRef.current?.scrollBy({ left: dir * 200, behavior: "smooth" });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ── Pill Search Bar ── */}
      <div className="pt-20 pb-4 border-b border-border bg-background sticky top-16 z-40">
        <div className="container">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center rounded-full border border-border bg-card shadow-search overflow-hidden">
              <button className="flex-1 flex items-center gap-2 px-5 py-3 text-left border-r border-border hover:bg-muted/50 transition-colors">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold text-foreground leading-none">Where</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Target country</p>
                </div>
              </button>
              <button className="flex-1 flex items-center gap-2 px-5 py-3 text-left border-r border-border hover:bg-muted/50 transition-colors">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold text-foreground leading-none">Who</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Education level</p>
                </div>
              </button>
              <div className="flex-1 flex items-center gap-2 px-4 py-2">
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-foreground leading-none mb-0.5">What</p>
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Field of study..."
                    className="h-auto p-0 border-0 shadow-none focus-visible:ring-0 text-xs placeholder:text-muted-foreground bg-transparent"
                  />
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full gradient-gold shrink-0">
                  <Search className="h-4 w-4 text-accent-foreground" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Category Strip ── */}
      <div className="border-b border-border bg-background sticky top-[8.5rem] z-30">
        <div className="container relative">
          <button onClick={() => scroll(-1)} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full border border-border bg-card shadow-sm flex items-center justify-center hover:shadow-card-hover transition-shadow hidden md:flex">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div ref={scrollRef} className="flex gap-6 overflow-x-auto no-scrollbar py-4 px-8 md:px-12">
            {CATEGORIES.map((cat) => {
              const active = activeCategory === cat.label;
              return (
                <button
                  key={cat.label}
                  onClick={() => setActiveCategory(cat.label)}
                  className={`flex flex-col items-center gap-1.5 shrink-0 pb-2 border-b-2 transition-colors ${
                    active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  <cat.icon className="h-5 w-5" />
                  <span className="text-xs font-medium whitespace-nowrap">{cat.label}</span>
                </button>
              );
            })}
          </div>
          <button onClick={() => scroll(1)} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full border border-border bg-card shadow-sm flex items-center justify-center hover:shadow-card-hover transition-shadow hidden md:flex">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div className="container py-8">
        {loading ? (
          <div className="text-center py-20 text-muted-foreground animate-pulse">Loading scholarships...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Radar className="h-16 w-16 text-accent/40 mb-6 animate-pulse" />
            <h3 className="text-xl font-semibold text-foreground mb-2">Our AI Scouts are currently indexing new grants.</h3>
            <p className="text-muted-foreground">Check back in 5 minutes!</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-5">{filtered.length} scholarship{filtered.length !== 1 ? "s" : ""}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in">
              {filtered.map((s, i) => {
                const days = daysLeft(s.deadline);
                const isSaved = savedIds.has(s.id);
                const gradient = CARD_GRADIENTS[i % CARD_GRADIENTS.length];
                return (
                  <div
                    key={s.id}
                    className="group cursor-pointer"
                    onClick={() => setSelected(s)}
                  >
                    {/* Card image / gradient area */}
                    <div className={`relative aspect-[4/3] rounded-2xl overflow-hidden bg-gradient-to-br ${gradient} mb-3`}>
                      {/* Deadline badge */}
                      {days !== null && (
                        <div className={`absolute top-3 right-3 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md ${
                          days <= 7 ? "bg-destructive/90 text-destructive-foreground" : "bg-background/80 text-foreground"
                        }`}>
                          {days <= 0 ? "Expired" : `${days}d left`}
                        </div>
                      )}

                      {/* Save button */}
                      <button
                        onClick={(e) => handleSave(s.id, e)}
                        disabled={savingId === s.id}
                        className="absolute top-3 left-3 h-8 w-8 rounded-full bg-background/70 backdrop-blur-md flex items-center justify-center hover:bg-background/90 transition-colors"
                      >
                        {isSaved ? (
                          <BookmarkCheck className="h-4 w-4 text-accent" />
                        ) : (
                          <Bookmark className="h-4 w-4 text-foreground" />
                        )}
                      </button>

                      {/* Centered icon */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <GraduationCap className="h-16 w-16 text-primary-foreground/20" />
                      </div>

                      {/* Amount overlay */}
                      {s.amount && (
                        <div className="absolute bottom-3 left-3 rounded-lg px-2.5 py-1 bg-background/80 backdrop-blur-md">
                          <span className="text-sm font-bold text-foreground">{fmtCurrency(s.amount, s.currency)}</span>
                          <span className="text-[11px] text-muted-foreground ml-1">total</span>
                        </div>
                      )}
                    </div>

                    {/* Card text */}
                    <div className="px-0.5">
                      <h3 className="font-semibold text-[15px] text-foreground leading-snug line-clamp-2 group-hover:text-accent transition-colors">
                        {s.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{s.description}</p>
                      {s.tags && s.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {s.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-[11px] text-muted-foreground bg-secondary rounded-full px-2 py-0.5">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Detail Drawer (Side Sheet) ── */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
          {selected && (
            <div>
              {/* Header gradient */}
              <div className={`aspect-[2/1] bg-gradient-to-br ${CARD_GRADIENTS[0]} relative flex items-center justify-center`}>
                <GraduationCap className="h-20 w-20 text-primary-foreground/20" />
                {selected.amount && (
                  <div className="absolute bottom-4 left-4 rounded-xl px-3 py-1.5 bg-background/80 backdrop-blur-md">
                    <span className="text-lg font-bold text-foreground">{fmtCurrency(selected.amount, selected.currency)}</span>
                    <span className="text-sm text-muted-foreground ml-1">total</span>
                  </div>
                )}
              </div>

              <div className="p-6 space-y-5">
                <SheetHeader className="text-left p-0 space-y-1">
                  <SheetTitle className="text-xl font-bold">{selected.title}</SheetTitle>
                  <SheetDescription className="text-sm text-muted-foreground">Scholarship details</SheetDescription>
                </SheetHeader>

                {selected.deadline && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Deadline: {new Date(selected.deadline).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                    {(() => { const d = daysLeft(selected.deadline); return d !== null && d > 0 ? <Badge variant="secondary" className="ml-1 text-xs">{d}d left</Badge> : null; })()}
                  </div>
                )}

                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {selected.description || "No description provided."}
                </p>

                {selected.eligibility_criteria && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Eligibility Criteria</h4>
                    <pre className="text-xs bg-secondary rounded-xl p-4 overflow-x-auto text-muted-foreground">{JSON.stringify(selected.eligibility_criteria, null, 2)}</pre>
                  </div>
                )}

                {selected.tags && selected.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selected.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs rounded-full">{tag}</Badge>
                    ))}
                  </div>
                )}

                {selected.source_url && (
                  <a href={selected.source_url} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline flex items-center gap-1">
                    <ExternalLink className="h-4 w-4" /> View Original Source
                  </a>
                )}

                <div className="flex gap-3 pt-4 border-t border-border">
                  <Button variant="outline" className="flex-1 rounded-xl gap-2" onClick={() => selected && handleSave(selected.id)}>
                    {savedIds.has(selected.id) ? <><BookmarkCheck className="h-4 w-4" /> Saved</> : <><Bookmark className="h-4 w-4" /> Save</>}
                  </Button>
                  <Button className="flex-1 rounded-xl gradient-gold text-accent-foreground font-semibold shadow-gold hover:opacity-90 transition-opacity" onClick={() => handleApply(selected.id)}>
                    Apply Now
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Scholarships;
