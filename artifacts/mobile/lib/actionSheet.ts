import type { ActionOption } from "@/lib/notice";

export type ActionSheetRequest = {
  id: string;
  title: string;
  message?: string;
  options: ActionOption[];
  /** Invoked once with the chosen option (or undefined when dismissed). */
  resolve: (chosen: ActionOption | undefined) => void;
};

type Listener = (request: ActionSheetRequest | null) => void;

let current: ActionSheetRequest | null = null;
const listeners = new Set<Listener>();
let counter = 0;

function emit() {
  listeners.forEach((listener) => listener(current));
}

/**
 * Subscribe to the single active action sheet. The listener is invoked
 * immediately with the current request and again whenever it changes. Returns
 * an unsubscribe function.
 */
export function subscribeActionSheet(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Present an action sheet (web only). Resolves with the option the user picked,
 * or `undefined` if they dismissed it. Only one sheet shows at a time; opening a
 * new one dismisses any sheet already on screen.
 */
export function presentActionSheet(
  title: string,
  message: string | undefined,
  options: ActionOption[]
): Promise<ActionOption | undefined> {
  if (current) {
    current.resolve(undefined);
    current = null;
  }
  return new Promise((resolve) => {
    counter += 1;
    current = {
      id: `action-sheet-${counter}`,
      title,
      message,
      options,
      resolve,
    };
    emit();
  });
}

/**
 * Finalize the active sheet. Resolves the pending promise with the chosen option
 * (or undefined when dismissed) and clears the sheet so the host unmounts it.
 */
export function resolveActionSheet(chosen: ActionOption | undefined) {
  if (!current) return;
  const { resolve } = current;
  current = null;
  emit();
  resolve(chosen);
}
