import { toast } from 'sonner';

/**
 * Copy arbitrary text, telling the player what happened either way.
 *
 * `navigator.clipboard` is unavailable on insecure origins and can be denied
 * by permissions policy, so the failure path is a real path, not paranoia:
 * we surface the value itself in a toast so it can still be selected by hand.
 */
export async function copyText(text: string, successMessage: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
    return true;
  } catch {
    // No error toast — the value IS the fallback. Showing it is more useful
    // than telling someone their browser said no.
    toast(text);
    return false;
  }
}

/** Copy the current room URL — the normal way people join is a pasted link. */
export async function copyLink(): Promise<boolean> {
  return copyText(window.location.href, 'Link copied');
}
