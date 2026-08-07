import { createContext, useContext, useMemo, type ReactNode } from "react";

import {
  createResourceRegistry,
  type ResourceRegistry,
} from "../shared/media/resourceRegistry";

const ResourceRegistryContext = createContext<ResourceRegistry | null>(null);

interface ResourceRegistryProviderProps {
  readonly children: ReactNode;
}

export function ResourceRegistryProvider({
  children,
}: ResourceRegistryProviderProps) {
  const registry = useMemo(() => createResourceRegistry(), []);

  return (
    <ResourceRegistryContext.Provider value={registry}>
      {children}
    </ResourceRegistryContext.Provider>
  );
}

export function useResourceRegistry() {
  const registry = useContext(ResourceRegistryContext);

  if (!registry) {
    throw new Error("ResourceRegistryProvider is missing.");
  }

  return registry;
}
