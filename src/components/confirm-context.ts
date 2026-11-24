import { createContext } from 'react';

export interface ConfirmOptions {
  title: string;
  description?: string;
  /** Button text, e.g. "Delete". Defaults to "Continue". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button, for deleting and other things that are hard to undo. */
  destructive?: boolean;
}

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<ConfirmFn | null>(null);
