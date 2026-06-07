import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Scissors, Clock, Users, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2 font-bold text-xl">
          <Scissors className="h-6 w-6 text-accent" />
          <span>TrimTrack</span>
        </div>
        <div className="flex gap-4">
          <Link href="/login">
            <Button variant="ghost">Login</Button>
          </Link>
          <Link href="/register">
            <Button>Get Started</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-4xl mx-auto w-full">
        <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 mb-6">
          The Modern Barbershop Experience
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-foreground">
          Take the chaos out of <br className="hidden md:block" />
          <span className="text-accent">walk-in visits.</span>
        </h1>
        
        <p className="text-xl text-muted-foreground mb-10 max-w-2xl">
          A smart, real-time queue system that lets customers see their place in line, 
          barbers manage their day, and admins get a clear operational view.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
          <Link href="/register">
            <Button size="lg" className="w-full sm:w-auto text-lg h-14 px-8">
              Join the Queue <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg" className="w-full sm:w-auto text-lg h-14 px-8">
              Barber Login
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 text-left">
          <div className="bg-card p-6 rounded-xl border shadow-sm">
            <div className="h-12 w-12 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-4">
              <Clock className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Real-time Waits</h3>
            <p className="text-muted-foreground">Customers see exactly how long they'll wait and their live position in the queue.</p>
          </div>
          <div className="bg-card p-6 rounded-xl border shadow-sm">
            <div className="h-12 w-12 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-4">
              <Scissors className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Barber Control</h3>
            <p className="text-muted-foreground">Barbers can manage their own lines, pause walk-ins, and mark customers as served.</p>
          </div>
          <div className="bg-card p-6 rounded-xl border shadow-sm">
            <div className="h-12 w-12 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-4">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Admin Overview</h3>
            <p className="text-muted-foreground">Shop owners get a bird's-eye view of all barbers, queues, and shop performance.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
