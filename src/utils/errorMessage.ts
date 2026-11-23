/** The API client rejects with { status, message }; anything else gets the fallback. */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong — try again.'): string {
  return err && typeof err === 'object' && 'message' in err && (err as { message: unknown }).message
    ? String((err as { message: unknown }).message)
    : fallback;
}
