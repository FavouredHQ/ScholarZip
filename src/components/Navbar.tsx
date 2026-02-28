import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap, MapPin, Users, BookOpen, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

const Navbar = () => {
  const { user, signOut, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [country, setCountry] = useState("");
  const [degree, setDegree] = useState("");
  const [field, setField] = useState("");

  const showSearch = location.pathname === "/scholarships";

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (country) params.set("country", country);
    if (degree) params.set("degree", degree);
    if (field) params.set("field", field);
    navigate(`/scholarships?${params.toString()}`);
  };

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

        {/* Pill Search Bar – centered */}
        {showSearch && (
          <div className="hidden md:flex items-center rounded-full border border-border bg-background shadow-search divide-x divide-border flex-1 max-w-xl mx-4">
            <div className="flex items-center gap-2.5 px-4 py-2 flex-1 min-w-0">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground leading-none">Where</p>
                <input
                  type="text"
                  placeholder="Target country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="bg-transparent border-0 outline-none text-xs text-muted-foreground placeholder:text-muted-foreground w-full mt-0.5"
                />
              </div>
            </div>
            <div className="flex items-center gap-2.5 px-4 py-2 flex-1 min-w-0">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground leading-none">Who</p>
                <input
                  type="text"
                  placeholder="Education level"
                  value={degree}
                  onChange={(e) => setDegree(e.target.value)}
                  className="bg-transparent border-0 outline-none text-xs text-muted-foreground placeholder:text-muted-foreground w-full mt-0.5"
                />
              </div>
            </div>
            <div className="flex items-center gap-2.5 pl-4 pr-1.5 py-1.5 flex-1 min-w-0">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground leading-none">What</p>
                <input
                  type="text"
                  placeholder="Field of study..."
                  value={field}
                  onChange={(e) => setField(e.target.value)}
                  className="bg-transparent border-0 outline-none text-xs text-muted-foreground placeholder:text-muted-foreground w-full mt-0.5"
                />
              </div>
              <button
                onClick={handleSearch}
                className="flex items-center justify-center h-8 w-8 rounded-full gradient-gold text-accent-foreground shrink-0 hover:opacity-90 transition-opacity"
              >
                <Search className="h-3.5 w-3.5" />
              </button>
            </div>
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
