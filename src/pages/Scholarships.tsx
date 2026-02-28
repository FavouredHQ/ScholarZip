import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import CategoryStrip from "@/components/scholarships/CategoryStrip";
import ScholarshipPillSearch from "@/components/scholarships/ScholarshipPillSearch";
import ScholarshipCard from "@/components/scholarships/ScholarshipCard";
import ScholarshipDetailDrawer from "@/components/scholarships/ScholarshipDetailDrawer";
import { ScholarshipSkeletonGrid } from "@/components/scholarships/ScholarshipSkeleton";
import OnboardingModal from "@/components/onboarding/OnboardingModal";
import { Radar } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

const Scholarships = () => {
  const { user } = useAuth();
  const [scholarships, setScholarships] = useState<Tables<"scholarships">[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Tables<"scholarships"> | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");

  // Pill search state
  const [searchCountry, setSearchCountry] = useState("");
  const [searchDegree, setSearchDegree] = useState("");
  const [searchField, setSearchField] = useState("");

  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(false);

  /* fetch data */
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

  /* check onboarding */
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("onboarding_completed").eq("id", user.id).single().then(({ data }) => {
      if (data && !data.onboarding_completed) setShowOnboarding(true);
    });
  }, [user]);

  /* filter */
  const filtered = useMemo(() => {
    const cq = searchCountry.toLowerCase();
    const dq = searchDegree.toLowerCase();
    const fq = searchField.toLowerCase();

    return scholarships.filter((s) => {
      const text = `${s.title} ${s.description ?? ""} ${(s.tags ?? []).join(" ")}`.toLowerCase();
      const matchesCountry = !cq || text.includes(cq);
      const matchesDegree = !dq || text.includes(dq);
      const matchesField = !fq || text.includes(fq);
      const matchesCat = activeCategory === "All" || s.tags?.some((t) => t.toLowerCase().includes(activeCategory.toLowerCase()));
      return matchesCountry && matchesDegree && matchesField && matchesCat;
    });
  }, [scholarships, searchCountry, searchDegree, searchField, activeCategory]);

  /* save / unsave */
  const handleSave = useCallback(async (scholarshipId: string, e?: React.MouseEvent) => {
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
      else { setSavedIds((p) => new Set(p).add(scholarshipId)); toast.success("Saved!"); }
    }
    setSavingId(null);
  }, [user, savedIds]);

  /* apply */
  const handleApply = async (scholarshipId: string) => {
    if (!user) { toast.error("Please sign in to apply"); return; }
    const { error } = await supabase.from("applications").insert({ student_id: user.id, scholarship_id: scholarshipId, status: "submitted", submitted_at: new Date().toISOString() });
    if (error) { error.code === "23505" ? toast.error("You've already applied!") : toast.error(error.message); }
    else { toast.success("Application submitted!"); setSelected(null); }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Pill search */}
      <div className="pt-20 pb-4 bg-card border-b border-border">
        <div className="container">
          <ScholarshipPillSearch
            country={searchCountry}
            degree={searchDegree}
            field={searchField}
            onCountryChange={setSearchCountry}
            onDegreeChange={setSearchDegree}
            onFieldChange={setSearchField}
            onSearch={() => {}}
          />
        </div>
      </div>

      {/* Category strip */}
      <CategoryStrip active={activeCategory} onChange={setActiveCategory} />

      {/* Main grid */}
      <div className="container py-8">
        {loading ? (
          <ScholarshipSkeletonGrid />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Radar className="h-16 w-16 text-accent/40 mb-6 animate-pulse" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No scholarships found.</h3>
            <p className="text-muted-foreground">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in">
            {filtered.map((s, i) => (
              <ScholarshipCard
                key={s.id}
                scholarship={s}
                index={i}
                isSaved={savedIds.has(s.id)}
                isSaving={savingId === s.id}
                onSave={handleSave}
                onClick={() => setSelected(s)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail drawer */}
      <ScholarshipDetailDrawer
        scholarship={selected}
        allScholarships={scholarships}
        isSaved={selected ? savedIds.has(selected.id) : false}
        onClose={() => setSelected(null)}
        onSave={(id) => handleSave(id)}
        onApply={handleApply}
      />

      {/* Onboarding modal */}
      {user && showOnboarding && (
        <OnboardingModal
          open={showOnboarding}
          userId={user.id}
          onComplete={() => setShowOnboarding(false)}
        />
      )}
    </div>
  );
};

export default Scholarships;
