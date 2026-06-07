import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";

import Home from "@/pages/home";
import Login from "@/pages/auth/login";
import Register from "@/pages/auth/register";
import NotFound from "@/pages/not-found";

import { DashboardLayout } from "@/components/layout/DashboardLayout";

import CustomerDashboard from "@/pages/customer/index";
import CustomerBook from "@/pages/customer/book";
import CustomerBookings from "@/pages/customer/bookings";

import BarberDashboard from "@/pages/barber/index";
import BarberQueue from "@/pages/barber/queue";

import AdminDashboard from "@/pages/admin/index";
import AdminUsers from "@/pages/admin/users";
import AdminServices from "@/pages/admin/services";
import AdminQueue from "@/pages/admin/queue";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

function ProtectedRoute({ component: Component, allowedRoles }: { component: React.ComponentType; allowedRoles: string[] }) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Login />;
  }

  if (user && !allowedRoles.includes(user.role)) {
    if (user.role === "customer") return <DashboardLayout><CustomerDashboard /></DashboardLayout>;
    if (user.role === "barber") return <DashboardLayout><BarberDashboard /></DashboardLayout>;
    if (user.role === "admin") return <DashboardLayout><AdminDashboard /></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <Component />
    </DashboardLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />

      <Route path="/customer">
        {() => <ProtectedRoute component={CustomerDashboard} allowedRoles={["customer"]} />}
      </Route>
      <Route path="/customer/book">
        {() => <ProtectedRoute component={CustomerBook} allowedRoles={["customer"]} />}
      </Route>
      <Route path="/customer/bookings">
        {() => <ProtectedRoute component={CustomerBookings} allowedRoles={["customer"]} />}
      </Route>

      <Route path="/barber">
        {() => <ProtectedRoute component={BarberDashboard} allowedRoles={["barber"]} />}
      </Route>
      <Route path="/barber/queue">
        {() => <ProtectedRoute component={BarberQueue} allowedRoles={["barber"]} />}
      </Route>

      <Route path="/admin">
        {() => <ProtectedRoute component={AdminDashboard} allowedRoles={["admin"]} />}
      </Route>
      <Route path="/admin/users">
        {() => <ProtectedRoute component={AdminUsers} allowedRoles={["admin"]} />}
      </Route>
      <Route path="/admin/services">
        {() => <ProtectedRoute component={AdminServices} allowedRoles={["admin"]} />}
      </Route>
      <Route path="/admin/queue">
        {() => <ProtectedRoute component={AdminQueue} allowedRoles={["admin"]} />}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
