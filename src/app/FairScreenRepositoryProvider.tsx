import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type {
  FairScreenRepository,
  StorageFailure,
  StorageOpenState,
} from "../domain/ports";
import { ResilientFairScreenRepository } from "../infrastructure/storage/repositories/ResilientFairScreenRepository";
import { EphemeralFairScreenRepository } from "../infrastructure/storage/ephemeral/EphemeralFairScreenRepository";

export type RepositoryStatus =
  "opening" | "persistent" | "read-only-recovery" | "unavailable";

interface FairScreenRepositoryContextValue {
  readonly repository: FairScreenRepository;
  readonly status: RepositoryStatus;
  readonly openState?: StorageOpenState;
  readonly error?: StorageFailure;
  readonly retry: () => Promise<void>;
}

const fallbackRepository = new EphemeralFairScreenRepository();

const FairScreenRepositoryContext =
  createContext<FairScreenRepositoryContextValue>({
    repository: fallbackRepository,
    status: "unavailable",
    error: {
      code: "unavailable",
      operation: "provider-missing",
      recoverable: true,
      actions: ["use-ephemeral-session", "export"],
    },
    retry: () => Promise.resolve(),
  });

interface FairScreenRepositoryProviderProps {
  readonly children: ReactNode;
  readonly repository?: FairScreenRepository;
}

export function FairScreenRepositoryProvider({
  children,
  repository: providedRepository,
}: FairScreenRepositoryProviderProps) {
  const repository = useMemo<FairScreenRepository>(
    () => providedRepository ?? new ResilientFairScreenRepository(),
    [providedRepository],
  );
  const [status, setStatus] = useState<RepositoryStatus>("opening");
  const [openState, setOpenState] = useState<StorageOpenState>();
  const [error, setError] = useState<StorageFailure>();

  const openRepository = useCallback(async () => {
    setStatus("opening");
    setError(undefined);
    const result = await repository.open();
    if (!result.ok) {
      setOpenState(undefined);
      setError(result.error);
      setStatus("unavailable");
      return;
    }

    setOpenState(result.value);
    setStatus(
      result.value.mode === "read-only-recovery"
        ? "read-only-recovery"
        : "persistent",
    );
  }, [repository]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void openRepository();
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
      repository.close();
    };
  }, [openRepository, repository]);

  const value = useMemo<FairScreenRepositoryContextValue>(
    () => ({
      repository,
      status,
      ...(openState ? { openState } : {}),
      ...(error ? { error } : {}),
      retry: openRepository,
    }),
    [error, openRepository, openState, repository, status],
  );

  return (
    <FairScreenRepositoryContext.Provider value={value}>
      {children}
    </FairScreenRepositoryContext.Provider>
  );
}

export function useFairScreenRepository() {
  return useContext(FairScreenRepositoryContext);
}
