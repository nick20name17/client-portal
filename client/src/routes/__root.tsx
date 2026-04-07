import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  Link,
  Outlet,
  useRouter,
} from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Home, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
  notFoundComponent: NotFound,
  errorComponent: ErrorPage,
});

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <p className="text-8xl font-bold text-primary">404</p>
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" asChild>
          <Link to="/">
            <Home data-icon="inline-start" />
            Home
          </Link>
        </Button>
      </div>
    </div>
  );
}

function ErrorPage({ error }: { error: unknown }) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-8 text-destructive" />
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {error instanceof Error
            ? error.message
            : "An unexpected error occurred."}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => router.history.back()}>
          <ArrowLeft data-icon="inline-start" />
          Go back
        </Button>
        <Button onClick={() => router.invalidate()}>
          <RotateCcw data-icon="inline-start" />
          Try again
        </Button>
      </div>
    </div>
  );
}
