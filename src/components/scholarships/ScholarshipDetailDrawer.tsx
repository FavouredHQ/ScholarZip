import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bookmark, BookmarkCheck, Calendar, ExternalLink } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const PLACEHOLDER_IMAGES = [
  "https://images.unsplash.com/photo-1562774053-701939374585?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1523050854058-8df90110c476?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1606761568499-6d2451b23c66?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=600&h=400&fit=crop",
];

const fmtCurrency = (amount: number | null, currency: string | null) => {
  if (!amount) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: 0 }).format(amount);
};

const daysLeft = (deadline: string | null) => {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
};

interface Props {
  scholarship: Tables<"scholarships"> | null;
  allScholarships: Tables<"scholarships">[];
  isSaved: boolean;
  onClose: () => void;
  onSave: (id: string) => void;
  onApply: (id: string) => void;
}

const ScholarshipDetailDrawer = ({ scholarship, allScholarships, isSaved, onClose, onSave, onApply }: Props) => {
  if (!scholarship) return null;

  const idx = allScholarships.indexOf(scholarship);
  const img = PLACEHOLDER_IMAGES[(idx >= 0 ? idx : 0) % PLACEHOLDER_IMAGES.length];

  return (
    <Sheet open={!!scholarship} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
        <div>
          <div className="relative aspect-[2/1] overflow-hidden">
            <img src={img} alt={scholarship.title} className="w-full h-full object-cover" />
            {scholarship.amount && (
              <div className="absolute bottom-4 left-4 rounded-[1.5rem] px-4 py-2 bg-card/80 backdrop-blur-md">
                <span className="text-lg font-bold text-foreground">{fmtCurrency(scholarship.amount, scholarship.currency)}</span>
                <span className="text-sm text-muted-foreground ml-1">/ Year</span>
              </div>
            )}
          </div>

          <div className="p-6 space-y-5">
            <SheetHeader className="text-left p-0 space-y-1">
              <SheetTitle className="text-xl font-bold">{scholarship.title}</SheetTitle>
              <SheetDescription className="text-sm text-muted-foreground">Scholarship details</SheetDescription>
            </SheetHeader>

            {scholarship.deadline && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Deadline: {new Date(scholarship.deadline).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                {(() => { const d = daysLeft(scholarship.deadline); return d !== null && d > 0 ? <Badge variant="secondary" className="ml-1 text-xs rounded-full">{d}d left</Badge> : null; })()}
              </div>
            )}

            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {scholarship.description || "No description provided."}
            </p>

            {scholarship.eligibility_criteria && typeof scholarship.eligibility_criteria === "object" && !Array.isArray(scholarship.eligibility_criteria) && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Eligibility Criteria</h4>
                <div className="space-y-1.5">
                  {Object.entries(scholarship.eligibility_criteria as Record<string, unknown>).map(([key, value]) => {
                    const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                    const display = Array.isArray(value) ? value.join(", ") : String(value);
                    return (
                      <div key={key} className="flex items-center justify-between text-sm bg-secondary rounded-lg px-4 py-2">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium text-foreground">{display}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {scholarship.tags && scholarship.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {scholarship.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs rounded-full">{tag}</Badge>
                ))}
              </div>
            )}

            {scholarship.source_url && (
              <a href={scholarship.source_url} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline flex items-center gap-1">
                <ExternalLink className="h-4 w-4" /> View Original Source
              </a>
            )}

            <div className="flex gap-3 pt-4 border-t border-border">
              <Button variant="outline" className="flex-1 rounded-[1.5rem] gap-2" onClick={() => onSave(scholarship.id)}>
                {isSaved ? <><BookmarkCheck className="h-4 w-4" /> Saved</> : <><Bookmark className="h-4 w-4" /> Save</>}
              </Button>
              <Button className="flex-1 rounded-[1.5rem] gradient-gold text-accent-foreground font-semibold shadow-gold hover:opacity-90 transition-opacity" onClick={() => onApply(scholarship.id)}>
                Apply Now
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ScholarshipDetailDrawer;
