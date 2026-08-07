import { normalizeQuestionText } from "./normalization";

export interface CustomQuestionValidationError {
  readonly index: number;
  readonly message: string;
}

export interface PreparedCustomQuestion {
  readonly clientId: string;
  readonly text: string;
  readonly order: number;
}

export function prepareCustomQuestions(values: readonly string[]): {
  readonly questions: readonly PreparedCustomQuestion[];
  readonly errors: readonly CustomQuestionValidationError[];
} {
  const errors: CustomQuestionValidationError[] = [];
  const seen = new Map<string, number>();
  const questions: PreparedCustomQuestion[] = [];

  values.forEach((value, index) => {
    const text = value.trim();
    if (!text) {
      return;
    }

    if (Array.from(text).length > 500) {
      errors.push({
        index,
        message: "Custom questions must be 500 characters or fewer.",
      });
      return;
    }

    const normalized = normalizeQuestionText(text);
    const duplicateIndex = seen.get(normalized);
    if (duplicateIndex !== undefined) {
      errors.push({
        index,
        message: `Custom question duplicates question ${duplicateIndex + 1}.`,
      });
      return;
    }

    seen.set(normalized, index);
    questions.push({
      clientId: `custom-${index + 1}`,
      text,
      order: questions.length,
    });
  });

  return { questions, errors };
}

export function moveArrayItem<Value>(
  values: readonly Value[],
  fromIndex: number,
  toIndex: number,
): readonly Value[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= values.length ||
    toIndex >= values.length ||
    fromIndex === toIndex
  ) {
    return values;
  }

  const nextValues = [...values];
  const [item] = nextValues.splice(fromIndex, 1);
  if (item === undefined) {
    return values;
  }

  nextValues.splice(toIndex, 0, item);
  return nextValues;
}

export function removeArrayItem<Value>(
  values: readonly Value[],
  index: number,
): readonly Value[] {
  return values.filter((_, currentIndex) => currentIndex !== index);
}
