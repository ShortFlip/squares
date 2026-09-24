import { toast } from 'sonner';

/*
 * Toasts for /library. The app's toaster sits bottom-right, which on this page
 * is the card pane's footer: a toast there covers Save Card for four seconds.
 * Library toasts go bottom-left instead, over the long item list, so the card
 * pane's actions never leave the screen.
 */
const at = { position: 'bottom-left' as const };

export const notify = {
  success: (message: string) => toast.success(message, at),
  error: (message: string) => toast.error(message, at),
  info: (message: string) => toast(message, at),
};
