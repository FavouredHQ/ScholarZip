import { Clock, Bookmark, BookmarkCheck, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/integrations/supabase/types";

const PLACEHOLDER_IMAGES = [
  "https://images.unsplash.com/photo-1562774053-701939374585?w=600&h=400&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&h=400&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=600&h=400&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?w=600&h=400&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1606761568499-6d2451b23c66?w=600&h=400&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=600&h=400&fit=crop&auto=format",
];

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

/* Deterministic rating from id */
const getRating = (id: string) => {
  const hash = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return (4.5 + (hash % 50) / 100).toFixed(2);
};

const isTopChoice = (id: string) => {
  const hash = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return hash % 3 === 0;
};

/* Deterministic provider type */
const getProviderType = (id: string) => {
  const hash = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const types = ["University", "Government", "Foundation", "Corporate"];
  return types[hash % types.length];
};

/* Deterministic provider name from description or fallback */
const getProviderName = (s: Tables<"scholarships">) => {
  const first = s.description?.split(".")[0];
  if (first && first.length < 60) return first;
  return "Scholarship Provider";
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
  const rating = getRating(s.id);
  const topChoice = isTopChoice(s.id);
  const providerType = getProviderType(s.id);
  const providerName = getProviderName(s);
  const desc = s.description ? s.description.slice(0, 120) + (s.description.length > 120 ? "..." : "") : "";

  return (
    <div className="group cursor-pointer" onClick={onClick}>
      {/* Image */}
      <div className="relative aspect-[4/3] rounded-xl overflow-hidden mb-3">
        <img
          src={img}
          alt={s.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = "/placeholder.svg";
          }}
        />

        {/* Top Choice badge */}
        {topChoice && (
          <div className="absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-semibold bg-card text-foreground shadow-sm">
            Top Choice
          </div>
        )}

        {/* Save button */}
        <button
          onClick={(e) => onSave(s.id, e)}
          disabled={isSaving}
          className="absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center transition-transform hover:scale-110"
        >
          {isSaved ? (
            <BookmarkCheck className="h-5 w-5 text-accent drop-shadow-md" />
          ) : (
            <Bookmark className="h-5 w-5 text-card drop-shadow-md" />
          )}
        </button>

        {/* Provider type badge – bottom left */}
        <Badge variant="secondary" className="absolute bottom-3 left-3 text-[10px] rounded-full px-2.5 py-0.5 shrink-0 bg-card/90 backdrop-blur-sm text-foreground shadow-sm">
          {providerType}
        </Badge>

        {/* Rating – bottom right */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full px-2.5 py-1 bg-card/90 backdrop-blur-sm shadow-sm">
          <Star className="h-3.5 w-3.5 fill-foreground text-foreground" />
          <span className="text-xs font-medium text-foreground">{rating}</span>
        </div>
      </div>

      {/* Card text */}
      <div className="space-y-0.5">
        <h3 className="font-semibold text-[15px] text-foreground leading-snug line-clamp-1">
          {s.title}
        </h3>

        {desc && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{desc}</p>
        )}

        {s.deadline && (
          <p className="text-sm text-muted-foreground">
            Deadline: {fmtDeadline(s.deadline)}
          </p>
        )}

        {s.amount && (
          <p className="text-sm pt-0.5">
            <span className="font-semibold text-foreground">{fmtCurrency(s.amount, s.currency)}</span>
            <span className="text-muted-foreground ml-1">total value</span>
          </p>
        )}
      </div>
    </div>
  );
};

export default ScholarshipCard;
