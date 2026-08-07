import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { QuestionProvider } from "../../domain/ports";
import { LocalQuestionProvider } from "./LocalQuestionProvider";

const QuestionProviderContext = createContext<QuestionProvider | null>(null);

interface QuestionProviderProviderProps {
  readonly children: ReactNode;
  readonly provider?: QuestionProvider;
}

export function QuestionProviderProvider({
  children,
  provider,
}: QuestionProviderProviderProps) {
  const defaultProvider = useMemo(() => new LocalQuestionProvider(), []);

  return (
    <QuestionProviderContext.Provider value={provider ?? defaultProvider}>
      {children}
    </QuestionProviderContext.Provider>
  );
}

export function useQuestionProvider() {
  const provider = useContext(QuestionProviderContext);

  if (!provider) {
    throw new Error("QuestionProviderProvider is missing.");
  }

  return provider;
}
