import type { ReactNode } from "react";

import { useResourceRegistry } from "./ResourceRegistryProvider";
import {
  ErrorBoundary,
  type ErrorBoundaryFallbackState,
} from "../shared/components/ErrorBoundary";
import { ErrorBoundaryFallback } from "../shared/components/ErrorBoundaryFallback";

interface RouteErrorBoundaryProps {
  readonly children: ReactNode;
}

export function RouteErrorBoundary({ children }: RouteErrorBoundaryProps) {
  const registry = useResourceRegistry();

  return (
    <ErrorBoundary
      fallback={(state: ErrorBoundaryFallbackState) => (
        <ErrorBoundaryFallback diagnosticCode={state.diagnosticCode} />
      )}
      onError={() => {
        void registry.disposeAll("route-error");
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
