import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, Home, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  resetKey: number;
}

/**
 * Top-level React error boundary.
 *
 * Client-side routing means an unhandled render error would otherwise blank the
 * whole SPA, so we keep the recovery actions local to the fallback.
 */
export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Global application error caught by boundary:", error, info);
  }

  private handleReset = (): void => {
    this.setState((prev) => ({ error: null, resetKey: prev.resetKey + 1 }));
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  render() {
    const { error, resetKey } = this.state;

    if (!error) {
      // Remounting the subtree clears any broken component state.
      return <div key={resetKey}>{this.props.children}</div>;
    }

    return (
      <div className="flex min-h-dvh-screen select-none flex-col items-center justify-center bg-background p-4 text-foreground">
        <Card className="w-full max-w-md text-center shadow-2xl">
          <CardHeader className="items-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10 text-destructive">
              <AlertCircle className="h-6 w-6" />
            </div>
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>
              An unexpected error occurred in the application. You can try
              again, reload the page, or head back home.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {error.message && (
              <div className="max-h-24 overflow-x-auto rounded-lg border border-border bg-secondary/40 p-2.5 text-left font-mono text-[11px] text-muted-foreground">
                {error.message}
              </div>
            )}

            <div className="flex flex-col items-center justify-center gap-2.5 sm:flex-row">
              <Button onClick={this.handleReset} className="w-full sm:w-auto">
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </Button>

              <Button
                onClick={this.handleReload}
                variant="secondary"
                className="w-full sm:w-auto"
              >
                Reload page
              </Button>

              <Button asChild variant="outline" className="w-full sm:w-auto">
                <a href="/">
                  <Home className="h-3.5 w-3.5" />
                  Home
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}
