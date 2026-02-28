import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  Search,
  GraduationCap,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Radar,
  Rocket,
  FlaskConical,
  Briefcase,
  BookOpen,
  Heart,
  Globe,
  Star,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Handshake,
  Music,
  Code,
  Microscope,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

/* ───── constants ───── */
const CATEGORIES = [
  { label: "All", icon: Rocket },
  { label: "STEM", icon: FlaskConical },
  { label: "Full-Ride", icon: GraduationCap },
  { label: "Merit", icon: Trophy },
  { label: "Need-based", icon: Handshake },
  { label: "Women in Tech", icon: Heart },
  { label: "International", icon: Globe },
  { label: "Research", icon: Microscope },
  { label: "MBA", icon: Briefcase },
  { label: "Humanities", icon: BookOpen },
  { label: "Technology", icon: Code },
  { label: "Music", icon: Music },
  { label: "Graduate", icon: Users },
];

const PLACEHOLDER_IMAGES = [
  "https://images.unsplash.com/photo-1562774053-701939374585?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1523050854058-8df90110c476?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1606761568499-6d2451b23c66?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=600&h=400&fit=crop",
];

/* ───── helpers ───── */
const daysLeft = (deadline: string | null) => {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
};

const fmtCurrency = (amount: number | null, currency: string | null) => {
  if (!amount) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(amount);
};

const fmtDeadline = (deadline: string | null) => {
  if (!deadline) return null;
  return new Date(deadline).toLocaleDateString("en-US", { month: "short", day: "2-digit" });
};

// Deterministic "rating" from scholarship id
const getRating = (id: string) => {
  const hash = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return (4.5 + (hash % 50) / 100).toFixed(2);
};

const isTopChoice = (id: string) => {
  const hash = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return hash % 3 === 0;
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

      {/* ── Category Strip ── */}
      <div className="border-b border-border bg-background sticky top-16 z-30 pt-4">
        <div className="container relative">
          <button onClick={() => scroll(-1)} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full border border-border bg-card shadow-sm items-center justify-center hover:shadow-card-hover transition-shadow hidden md:flex">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div ref={scrollRef} className="flex gap-8 overflow-x-auto no-scrollbar py-3 px-8 md:px-12">
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
                  <span className="text-[11px] font-medium whitespace-nowrap">{cat.label}</span>
                </button>
              );
            })}
          </div>
          <button onClick={() => scroll(1)} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full border border-border bg-card shadow-sm items-center justify-center hover:shadow-card-hover transition-shadow hidden md:flex">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Search bar (inline) ── */}
      <div className="container pt-5 pb-2">
        <div className="max-w-md">
          <div className="flex items-center gap-2 rounded-full border border-border bg-card shadow-search px-4 py-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search scholarships..."
              className="h-auto p-0 border-0 shadow-none focus-visible:ring-0 text-sm placeholder:text-muted-foreground bg-transparent"
            />
          </div>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div className="container py-6">
        {loading ? (
          <div className="text-center py-20 text-muted-foreground animate-pulse">Loading scholarships...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Radar className="h-16 w-16 text-accent/40 mb-6 animate-pulse" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No scholarships found.</h3>
            <p className="text-muted-foreground">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10 animate-fade-in">
            {filtered.map((s, i) => {
              const isSaved = savedIds.has(s.id);
              const img = PLACEHOLDER_IMAGES[i % PLACEHOLDER_IMAGES.length];
              const rating = getRating(s.id);
              const topChoice = isTopChoice(s.id);

              return (
                <div key={s.id} className="group cursor-pointer" onClick={() => setSelected(s)}>
                  {/* Image */}
                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden mb-3">
                    <img
                      src={img}
                      alt={s.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />

                    {/* Top Choice badge */}
                    {topChoice && (
                      <div className="absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-semibold bg-card text-foreground shadow-sm">
                        Top Choice
                      </div>
                    )}

                    {/* Save button */}
                    <button
                      onClick={(e) => handleSave(s.id, e)}
                      disabled={savingId === s.id}
                      className="absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center transition-colors hover:scale-110"
                    >
                      {isSaved ? (
                        <BookmarkCheck className="h-5 w-5 text-accent drop-shadow-md" />
                      ) : (
                        <Bookmark className="h-5 w-5 text-card drop-shadow-md" />
                      )}
                    </button>
                  </div>

                  {/* Card text */}
                  <div className="space-y-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-[15px] text-foreground leading-snug line-clamp-1">
                        {s.title}
                      </h3>
                      <div className="flex items-center gap-1 shrink-0 pt-0.5">
                        <Star className="h-3.5 w-3.5 fill-foreground text-foreground" />
                        <span className="text-sm text-foreground">{rating}</span>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {s.description?.split(".")[0] || "Scholarship Provider"}
                    </p>

                    {s.deadline && (
                      <p className="text-sm text-muted-foreground">
                        Deadline: {fmtDeadline(s.deadline)}
                      </p>
                    )}

                    {s.amount && (
                      <p className="text-sm pt-1">
                        <span className="font-semibold text-foreground">{fmtCurrency(s.amount, s.currency)}</span>
                        <span className="text-muted-foreground ml-1">total value</span>
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Detail Drawer ── */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
          {selected && (() => {
            const idx = scholarships.indexOf(selected);
            const img = PLACEHOLDER_IMAGES[(idx >= 0 ? idx : 0) % PLACEHOLDER_IMAGES.length];
            const rating = getRating(selected.id);
            return (
              <div>
                {/* Header image */}
                <div className="relative aspect-[2/1] overflow-hidden">
                  <img src={img} alt={selected.title} className="w-full h-full object-cover" />
                  {selected.amount && (
                    <div className="absolute bottom-4 left-4 rounded-xl px-3 py-1.5 bg-card/80 backdrop-blur-md">
                      <span className="text-lg font-bold text-foreground">{fmtCurrency(selected.amount, selected.currency)}</span>
                      <span className="text-sm text-muted-foreground ml-1">total value</span>
                    </div>
                  )}
                </div>

                <div className="p-6 space-y-5">
                  <SheetHeader className="text-left p-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <SheetTitle className="text-xl font-bold">{selected.title}</SheetTitle>
                      <div className="flex items-center gap-1 shrink-0">
                        <Star className="h-4 w-4 fill-foreground text-foreground" />
                        <span className="text-sm font-medium">{rating}</span>
                      </div>
                    </div>
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
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Scholarships;
