import { Link } from "react-router-dom";
import { ArrowLeft, Code2, Compass } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh-screen flex-col items-center justify-center overflow-hidden bg-background p-4 text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-[120px]" />
      </div>

      <Link
        to="/"
        className="group mb-8 inline-flex items-center gap-2.5 text-foreground"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-primary-foreground shadow-lg shadow-accent/25 transition-transform group-hover:scale-105">
          <Code2 className="h-6 w-6" />
        </div>
        <span className="text-2xl font-bold tracking-tight">
          Code<span className="text-accent">Room</span>
        </span>
      </Link>

      <Card className="w-full max-w-md text-center shadow-2xl">
        <CardHeader className="items-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-secondary text-accent">
            <Compass className="h-6 w-6" />
          </div>
          <CardTitle>Page not found</CardTitle>
          <CardDescription>
            The page you are looking for does not exist, or the room link is
            incomplete.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <Button asChild className="w-full sm:w-auto">
              <Link to="/dashboard">Go to Dashboard</Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link to="/">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back Home
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
