import { useContext } from 'react';
import { ConfirmContext, type ConfirmFn } from '../components/confirm-context';

/**
 * Styled replacement for window.confirm():
 *   if (!(await confirm({ title: 'Delete this trip?', destructive: true, confirmLabel: 'Delete' }))) return;
 */
export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmContext);
  if (!fn) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return fn;
}
