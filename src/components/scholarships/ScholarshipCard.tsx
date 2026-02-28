import { Clock, Bookmark, BookmarkCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/integrations/supabase/types";

const PLACEHOLDER_IMAGES = [
  "https://images.unsplash.com/photo-1562774053-701939374585?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1523050854058-8df90110c476?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1606761568499-6d2451b23c66?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=600&h=400&fit=crop",
];

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

/* Deterministic provider type from scholarship id */
const getProviderType = (id: string) => {
  const hash = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const types = ["University", "Government", "Foundation", "Corporate"];
  return types[hash % types.length];
};

const providerColors: Record<string, string> = {
  University: "bg-blue-100 text-blue-700",
  Government: "bg-emerald-100 text-emerald-700",
  Foundation: "bg-purple-100 text-purple-700",
  Corporate: "bg-amber-100 text-amber-700",
};

interface Props {
  scholarship: Tables<"scholarships">;
  index: number;
  isSaved: boolean;
  isSaving: boolean;
  onSave: (id: string, e?: React.MouseEvent) => void;
  onClick: () => void;
}

const ScholarshipCard = ({ scholarship: s, index, isSaved, isSaving, onSave, onClick }: Props) => {
  const img = PLACEHOLDER_IMAGES[index % PLACEHOLDER_IMAGES.length];
  const providerType = getProviderType(s.id);
  const days = daysLeft(s.deadline);
  const providerName = s.description?.split(".")[0] || "Scholarship Provider";

  return (
    <div
      className="group cursor-pointer rounded-[1.5rem] bg-card border border-border overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300"
      onClick={onClick}
    >
      {/* Image with provider overlay */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={img}
          alt={s.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        {/* Provider name overlay */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-foreground/60 to-transparent p-4 pt-10">
          <span className="text-sm font-medium text-card">{providerName}</span>
        </div>

        {/* Save button */}
        <button
          onClick={(e) => onSave(s.id, e)}
          disabled={isSaving}
          className="absolute top-3 right-3 h-9 w-9 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center transition-all hover:bg-card hover:scale-110"
        >
          {isSaved ? (
            <BookmarkCheck className="h-4 w-4 text-accent" />
          ) : (
            <Bookmark className="h-4 w-4 text-foreground" />
          )}
        </button>
      </div>

      {/* Card body */}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-[15px] text-foreground leading-snug line-clamp-2">
            {s.title}
          </h3>
          <Badge
            variant="secondary"
            className={`text-[10px] font-semibold shrink-0 rounded-full px-2 ${providerColors[providerType] || ""}`}
          >
            {providerType}
          </Badge>
        </div>

        {s.amount && (
          <p className="text-lg font-bold text-foreground">
            {fmtCurrency(s.amount, s.currency)}
            <span className="text-xs font-normal text-muted-foreground ml-1">/ Year</span>
          </p>
        )}

        {s.deadline && days !== null && days > 0 && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Ends in {days} days</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScholarshipCard;
