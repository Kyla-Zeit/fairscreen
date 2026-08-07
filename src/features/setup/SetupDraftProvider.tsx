import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { createDefaultSetupDraft, type SetupDraft } from "./setupDraft";

interface SetupDraftContextValue {
  readonly draft: SetupDraft;
  readonly isDirty: boolean;
  readonly updateDraft: (update: Partial<SetupDraft>) => void;
  readonly replaceDraft: (draft: SetupDraft) => void;
  readonly resetDraft: () => void;
}

const SetupDraftContext = createContext<SetupDraftContextValue | null>(null);

interface SetupDraftProviderProps {
  readonly children: ReactNode;
  readonly initialDraft?: SetupDraft;
}

export function SetupDraftProvider({
  children,
  initialDraft,
}: SetupDraftProviderProps) {
  const [draft, setDraft] = useState<SetupDraft>(
    () => initialDraft ?? createDefaultSetupDraft(),
  );
  const [baseline, setBaseline] = useState<SetupDraft>(() => draft);

  const updateDraft = useCallback((update: Partial<SetupDraft>) => {
    setDraft((currentDraft) => ({ ...currentDraft, ...update }));
  }, []);

  const replaceDraft = useCallback((nextDraft: SetupDraft) => {
    setDraft(nextDraft);
    setBaseline(nextDraft);
  }, []);

  const resetDraft = useCallback(() => {
    const nextDraft = createDefaultSetupDraft();
    setDraft(nextDraft);
    setBaseline(nextDraft);
  }, []);

  const value = useMemo<SetupDraftContextValue>(
    () => ({
      draft,
      isDirty: JSON.stringify(draft) !== JSON.stringify(baseline),
      replaceDraft,
      resetDraft,
      updateDraft,
    }),
    [baseline, draft, replaceDraft, resetDraft, updateDraft],
  );

  return (
    <SetupDraftContext.Provider value={value}>
      {children}
    </SetupDraftContext.Provider>
  );
}

export function useSetupDraft() {
  const context = useContext(SetupDraftContext);

  if (!context) {
    throw new Error("SetupDraftProvider is missing.");
  }

  return context;
}
