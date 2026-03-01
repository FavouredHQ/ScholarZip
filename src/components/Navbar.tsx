import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap, MapPin, GraduationCap as DegreeIcon, BookOpen, Search, SlidersHorizontal } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface NavbarProps {
  searchCountry?: string;
  searchDegree?: string;
  searchField?: string;
  onCountryChange?: (v: string) => void;
  onDegreeChange?: (v: string) => void;
  onFieldChange?: (v: string) => void;
}

const Navbar = ({
  searchCountry = "",
  searchDegree = "",
  searchField = "",
  onCountryChange,
  onDegreeChange,
  onFieldChange,
}: NavbarProps) => {
  const { user, signOut, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isScholarships = location.pathname === "/scholarships";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-card">
      <div className="container flex h-16 items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-semibold text-lg text-foreground shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-gold">
            <GraduationCap className="h-4 w-4 text-accent-foreground" />
          </div>
          <span className="hidden sm:inline">ScholarFlow</span>
        </Link>

        {/* Centre: Pill search + Filter – only on /scholarships */}
        {isScholarships && onCountryChange && (
          <div className="hidden md:flex items-center gap-3 absolute left-1/2 -translate-x-1/2">
            <div className="flex items-center rounded-full border border-border bg-background shadow-search divide-x divide-border">
              <div className="flex items-center gap-2 px-4 py-2 min-w-0">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="Target Country"
                  value={searchCountry}
                  onChange={(e) => onCountryChange(e.target.value)}
                  className="bg-transparent border-0 outline-none text-xs text-foreground placeholder:text-muted-foreground w-28"
                />
              </div>
              <div className="flex items-center gap-2 px-4 py-2 min-w-0">
                <DegreeIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="Degree Level"
                  value={searchDegree}
                  onChange={(e) => onDegreeChange?.(e.target.value)}
                  className="bg-transparent border-0 outline-none text-xs text-foreground placeholder:text-muted-foreground w-24"
                />
              </div>
              <div className="flex items-center gap-2 pl-4 pr-1.5 py-1.5 min-w-0">
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="Field of Study"
                  value={searchField}
                  onChange={(e) => onFieldChange?.(e.target.value)}
                  className="bg-transparent border-0 outline-none text-xs text-foreground placeholder:text-muted-foreground w-24"
                />
                <button className="flex items-center justify-center h-7 w-7 rounded-full gradient-gold text-accent-foreground shrink-0 hover:opacity-90 transition-opacity">
                  <Search className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-xs font-medium gap-1.5 border-border shrink-0"
              onClick={() => {/* Filter functionality can be added */}}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filter
            </Button>
          </div>
        )}

        {/* Nav links */}
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" className="text-sm font-medium" onClick={() => navigate('/scholarships')}>
            Discover
          </Button>
          {user ? (
            <>
              <Button variant="ghost" size="sm" className="text-sm font-medium" onClick={() => navigate(role === 'provider' ? '/provider' : '/dashboard')}>
                Dashboard
              </Button>
              <Button variant="ghost" size="sm" className="text-sm font-medium" onClick={() => navigate('/profile')}>
                Profile
              </Button>
              {role === 'admin' && (
                <Button variant="ghost" size="sm" className="text-sm font-medium" onClick={() => navigate('/admin')}>
                  Admin
                </Button>
              )}
              <Button variant="outline" size="sm" className="ml-1 text-sm rounded-full" onClick={signOut}>
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="text-sm font-medium" onClick={() => navigate('/auth')}>
                Sign In
              </Button>
              <Button
                size="sm"
                className="ml-1 gradient-gold text-accent-foreground font-semibold shadow-gold hover:opacity-90 transition-opacity rounded-full"
                onClick={() => navigate('/auth?tab=signup')}
              >
                Get Started
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
