import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Database, Globe, Zap, ArrowLeft } from "lucide-react";

const navItems = [
  { to: "/admin/hubs", label: "Source Hubs", icon: Globe },
  { to: "/admin/queue", label: "URL Queue", icon: Database },
  { to: "/admin/jobs", label: "Jobs", icon: Zap },
];

const AdminLayout = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-card">
        <div className="container flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="font-semibold text-foreground text-sm">Admin</span>
            <div className="flex items-center gap-1">
              {navItems.map((item) => {
                const active = location.pathname === item.to;
                return (
                  <Link key={item.to} to={item.to}>
                    <Button
                      variant={active ? "default" : "ghost"}
                      size="sm"
                      className={`text-xs gap-1.5 ${active ? "gradient-gold text-accent-foreground" : ""}`}
                    >
                      <item.icon className="h-3.5 w-3.5" />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </div>
          </div>
          <Button variant="outline" size="sm" className="text-xs rounded-full" onClick={signOut}>
            Sign Out
          </Button>
        </div>
      </nav>
      <main className="container pt-20 pb-12">{children}</main>
    </div>
  );
};

export default AdminLayout;
