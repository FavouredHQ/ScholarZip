import { Search, MapPin, GraduationCap, BookOpen } from "lucide-react";

interface Props {
  country: string;
  degree: string;
  field: string;
  onCountryChange: (v: string) => void;
  onDegreeChange: (v: string) => void;
  onFieldChange: (v: string) => void;
  onSearch: () => void;
}

const ScholarshipPillSearch = ({
  country, degree, field,
  onCountryChange, onDegreeChange, onFieldChange, onSearch,
}: Props) => {
  return (
    <div className="flex items-center rounded-full border border-border bg-card shadow-search divide-x divide-border max-w-2xl mx-auto">
      {/* Target Country */}
      <div className="flex items-center gap-2 px-5 py-3 flex-1 min-w-0">
        <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder="Target Country"
          value={country}
          onChange={(e) => onCountryChange(e.target.value)}
          className="bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground w-full"
        />
      </div>

      {/* Degree Level */}
      <div className="flex items-center gap-2 px-5 py-3 flex-1 min-w-0 hidden sm:flex">
        <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder="Degree Level"
          value={degree}
          onChange={(e) => onDegreeChange(e.target.value)}
          className="bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground w-full"
        />
      </div>

      {/* Field of Study */}
      <div className="flex items-center gap-2 px-5 py-3 flex-1 min-w-0 hidden md:flex">
        <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder="Field of Study"
          value={field}
          onChange={(e) => onFieldChange(e.target.value)}
          className="bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground w-full"
        />
      </div>

      {/* Search button */}
      <button
        onClick={onSearch}
        className="flex items-center justify-center h-10 w-10 rounded-full gradient-gold text-accent-foreground m-1.5 shrink-0 hover:opacity-90 transition-opacity"
      >
        <Search className="h-4 w-4" />
      </button>
    </div>
  );
};

export default ScholarshipPillSearch;
