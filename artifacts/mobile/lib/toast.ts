export type ToastVariant = "success" | "error" | "info";

export type ToastItem = {
  id: string;
  title: string;
  message?: string;
  variant: ToastVariant;
  duration: number;
};

export type ShowToastOptions = {
  title: string;
  message?: string;
  variant?: ToastVariant;
  duration?: number;
};

type Listener = (toasts: ToastItem[]) => void;

const DEFAULT_DURATION = 4000;
const MAX_VISIBLE = 3;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();
let counter = 0;

function emit() {
  const snapshot = [...toasts];
  listeners.forEach((listener) => listener(snapshot));
}

/**
 * Subscribe to the toast queue. The listener is invoked immediately with the
 * current toasts and again whenever the queue changes. Returns an unsubscribe
 * function.
 */
export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener([...toasts]);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Enqueue a toast. Newest toasts render first; the queue is capped at
 * MAX_VISIBLE so a burst of notices never floods the screen. Returns the id of
 * the created toast.
 */
export function showToast({
  title,
  message,
  variant = "info",
  duration = DEFAULT_DURATION,
}: ShowToastOptions): string {
  counter += 1;
  const id = `toast-${counter}`;
  const item: ToastItem = { id, title, message, variant, duration };
  toasts = [item, ...toasts].slice(0, MAX_VISIBLE);
  emit();
  return id;
}

/** Remove a toast by id (called when it auto-dismisses or is tapped). */
export function dismissToast(id: string) {
  const next = toasts.filter((t) => t.id !== id);
  if (next.length !== toasts.length) {
    toasts = next;
    emit();
  }
}
