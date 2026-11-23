import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminSpeciesApi } from '../../api/admin/species';
import type { Species } from '../../types/species';
import { apiErrorMessage } from '../../utils/errorMessage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Review =
  | { kind: 'approve'; item: Species; commonName: string; scientificName: string; category: string; description: string }
  | { kind: 'reject'; item: Species; reason: string };

/** Pending species requests from anglers, oldest first (FR-42, UC-32). */
export function SpeciesRequestsQueue({ onApproved }: { onApproved: () => void }) {
  const [pending, setPending] = useState<Species[] | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    adminSpeciesApi.getPendingRequests().then(setPending).catch(() => setPending([]));
  useEffect(() => { load(); }, []);

  const close = () => { setReview(null); setError(null); };

  const submit = async () => {
    if (!review) return;
    setBusy(true);
    setError(null);
    try {
      if (review.kind === 'approve') {
        await adminSpeciesApi.approve(review.item.id, {
          commonName: review.commonName.trim(),
          scientificName: review.scientificName.trim(),
          category: review.category.trim(),
          description: review.description.trim(),
        });
        toast.success(`'${review.commonName.trim()}' approved and added to the list.`);
        onApproved();
      } else {
        if (review.reason.trim().length < 3) {
          setError('Give a short reason so the angler knows why.');
          setBusy(false);
          return;
        }
        await adminSpeciesApi.reject(review.item.id, review.reason.trim());
        toast.success('Request rejected. The angler has been notified.');
      }
      close();
      load();
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't save the decision — try again."));
    } finally {
      setBusy(false);
    }
  };

  if (!pending || pending.length === 0) {
    return (
      <p className="mb-6 text-sm text-muted-foreground">
        {pending ? 'No species requests waiting.' : 'Loading requests…'}
      </p>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-heading text-lg">Requests waiting ({pending.length})</h2>
      <div className="space-y-2">
        {pending.map((s) => (
          <div key={s.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3">
            <div className="min-w-0 text-sm">
              <strong>{s.commonName}</strong>
              {s.scientificName && <span className="italic text-muted-foreground"> · {s.scientificName}</span>}
              <p className="m-0 text-xs text-muted-foreground">
                {s.requestedByName ?? 'Unknown angler'} · {new Date(s.createdAt).toLocaleDateString()}
              </p>
              {s.description && <p className="m-0 mt-1">{s.description}</p>}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => setReview({
                  kind: 'approve',
                  item: s,
                  commonName: s.commonName,
                  scientificName: s.scientificName ?? '',
                  category: s.category ?? '',
                  description: s.description ?? '',
                })}
              >
                Approve…
              </Button>
              <Button size="sm" variant="outline" onClick={() => setReview({ kind: 'reject', item: s, reason: '' })}>
                Reject…
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!review} onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {review?.kind === 'approve' ? `Approve '${review.item.commonName}'` : `Reject '${review?.item.commonName}'`}
            </DialogTitle>
          </DialogHeader>

          {review?.kind === 'approve' && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">Correct anything before it goes into the species list.</p>
              <div className="space-y-1">
                <Label htmlFor="ap-common">Common name *</Label>
                <Input id="ap-common" value={review.commonName} maxLength={100}
                  onChange={(e) => setReview({ ...review, commonName: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ap-sci">Scientific name</Label>
                <Input id="ap-sci" value={review.scientificName} maxLength={150}
                  onChange={(e) => setReview({ ...review, scientificName: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ap-cat">Category</Label>
                <Input id="ap-cat" value={review.category} maxLength={100}
                  onChange={(e) => setReview({ ...review, category: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ap-desc">Description</Label>
                <Textarea id="ap-desc" rows={2} value={review.description} maxLength={1000}
                  onChange={(e) => setReview({ ...review, description: e.target.value })} />
              </div>
            </div>
          )}

          {review?.kind === 'reject' && (
            <div className="space-y-1 text-sm">
              <Label htmlFor="rej-reason">Reason (sent to the angler) *</Label>
              <Textarea id="rej-reason" rows={3} maxLength={500} value={review.reason}
                placeholder="e.g. Already listed as 'Mangrove Jack'"
                onChange={(e) => setReview({ ...review, reason: e.target.value })} />
            </div>
          )}

          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button
              type="button"
              variant={review?.kind === 'reject' ? 'destructive' : 'default'}
              onClick={submit}
              disabled={busy || (review?.kind === 'approve' && review.commonName.trim().length < 2)}
            >
              {busy ? 'Saving…' : review?.kind === 'reject' ? 'Reject' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
