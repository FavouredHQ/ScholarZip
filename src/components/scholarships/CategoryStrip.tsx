import { useRef } from "react";
import {
  Rocket, GraduationCap, FlaskConical, Briefcase, BookOpen, Heart, Globe,
  ChevronLeft, ChevronRight, Trophy, Handshake,
} from "lucide-react";

const CATEGORIES = [
  { label: "All", icon: Rocket },
  { label: "Full-Ride", icon: GraduationCap },
  { label: "STEM", icon: FlaskConical },
  { label: "MBA", icon: Briefcase },
  { label: "Humanities", icon: BookOpen },
  { label: "Women in Tech", icon: Heart },
  { label: "Developing Nations", icon: Globe },
  { label: "Merit", icon: Trophy },
  { label: "Need-based", icon: Handshake },
];

interface Props {
  active: string;
  onChange: (cat: string) => void;
}

const CategoryStrip = ({ active, onChange }: Props) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) =>
    scrollRef.current?.scrollBy({ left: dir * 200, behavior: "smooth" });

  return (
    <div className="border-b border-border bg-card sticky top-16 z-30">
      <div className="container relative">
        <button
          onClick={() => scroll(-1)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full border border-border bg-card shadow-sm items-center justify-center hover:shadow-card-hover transition-shadow hidden md:flex"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div
          ref={scrollRef}
          className="flex gap-8 overflow-x-auto no-scrollbar py-3 px-8 md:px-12 justify-center"
        >
          {CATEGORIES.map((cat) => {
            const isActive = active === cat.label;
            return (
              <button
                key={cat.label}
                onClick={() => onChange(cat.label)}
                className={`flex flex-col items-center gap-1.5 shrink-0 pb-2 border-b-2 transition-colors ${
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <cat.icon className="h-5 w-5" />
                <span className="text-[11px] font-medium whitespace-nowrap">
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => scroll(1)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full border border-border bg-card shadow-sm items-center justify-center hover:shadow-card-hover transition-shadow hidden md:flex"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default CategoryStrip;
