export type ResourceDisposeReason =
  "manual-stop" | "route-change" | "route-error" | "test-teardown";

export interface ManagedResource {
  readonly id: string;
  dispose(reason: ResourceDisposeReason): void | Promise<void>;
}

export interface ResourceDisposeResult {
  readonly id: string;
  readonly status: "disposed" | "failed";
}

export interface ResourceRegistry {
  register(resource: ManagedResource): () => void;
  disposeAll(
    reason: ResourceDisposeReason,
  ): Promise<readonly ResourceDisposeResult[]>;
  activeCount(): number;
  snapshot(): readonly string[];
}

export function createResourceRegistry(): ResourceRegistry {
  const resources = new Map<string, ManagedResource>();

  return {
    register(resource) {
      resources.set(resource.id, resource);

      return () => {
        resources.delete(resource.id);
      };
    },
    async disposeAll(reason) {
      const pendingResources = Array.from(resources.values());
      resources.clear();

      return Promise.all(
        pendingResources.map(async (resource) => {
          try {
            await resource.dispose(reason);
            return { id: resource.id, status: "disposed" as const };
          } catch {
            return { id: resource.id, status: "failed" as const };
          }
        }),
      );
    },
    activeCount() {
      return resources.size;
    },
    snapshot() {
      return Array.from(resources.keys()).sort();
    },
  };
}
