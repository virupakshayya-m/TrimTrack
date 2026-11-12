import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Scissors, Calendar, Users, LayoutDashboard, Clock, LogOut, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout: clearAuth } = useAuth();
  const [location] = useLocation();
  const logoutMutation = useLogout();

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // Ignore errors
    } finally {
      clearAuth();
    }
  };

  const getLinks = () => {
    if (user?.role === "customer") {
      return [
        { href: "/customer", label: "My Status", icon: Clock },
        { href: "/customer/book", label: "Book Appointment", icon: Calendar },
        { href: "/customer/bookings", label: "History", icon: LayoutDashboard },
      ];
    }
    if (user?.role === "barber") {
      return [
        { href: "/barber", label: "Dashboard", icon: LayoutDashboard },
        { href: "/barber/queue", label: "Manage Queue", icon: Users },
      ];
    }
    if (user?.role === "admin") {
      return [
        { href: "/admin", label: "Overview", icon: LayoutDashboard },
        { href: "/admin/queue", label: "Live Queues", icon: Clock },
        { href: "/admin/users", label: "Users", icon: Users },
        { href: "/admin/services", label: "Services", icon: Scissors },
      ];
    }
    return [];
  };

  const links = getLinks();

  const navLinks = (
    <>
      {links.map((link) => (
        <Link key={link.href} href={link.href}>
          <div
            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
              location === link.href
                ? "bg-accent text-accent-foreground font-medium"
                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            }`}
          >
            <link.icon className="h-5 w-5" />
            {link.label}
          </div>
        </Link>
      ))}
    </>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Nav */}
      <div className="md:hidden flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-2 font-bold text-lg">
          <Scissors className="h-5 w-5 text-accent" />
          <span>TrimTrack</span>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 bg-sidebar">
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-2 font-bold text-xl mb-8 mt-4">
                <Scissors className="h-6 w-6 text-accent" />
                <span>TrimTrack</span>
              </div>
              <div className="flex flex-col gap-2 flex-1">
                {navLinks}
              </div>
              <div className="mt-auto border-t pt-4">
                <div className="px-3 mb-4">
                  <p className="font-medium truncate">{user?.name}</p>
                  <p className="text-sm text-sidebar-foreground/60 capitalize">{user?.role}</p>
                </div>
                <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
                  <LogOut className="h-5 w-5 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 flex-col bg-sidebar border-r min-h-screen p-4">
        <div className="flex items-center gap-2 font-bold text-xl mb-8 px-2">
          <Scissors className="h-6 w-6 text-accent" />
          <span>TrimTrack</span>
        </div>
        <div className="flex flex-col gap-2 flex-1">
          {navLinks}
        </div>
        <div className="mt-auto border-t pt-4">
          <div className="px-3 mb-4">
            <p className="font-medium truncate">{user?.name}</p>
            <p className="text-sm text-sidebar-foreground/60 capitalize">{user?.role}</p>
          </div>
          <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
            <LogOut className="h-5 w-5 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
