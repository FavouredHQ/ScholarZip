import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const Navbar = () => {
  const { user, signOut, role } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-semibold text-lg text-foreground">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-gold">
            <GraduationCap className="h-4 w-4 text-accent-foreground" />
          </div>
          <span className="hidden sm:inline">ScholarFlow</span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
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
              <Button variant="outline" size="sm" className="ml-1 text-sm" onClick={signOut}>
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
                className="ml-1 gradient-gold text-accent-foreground font-semibold shadow-gold hover:opacity-90 transition-opacity"
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
