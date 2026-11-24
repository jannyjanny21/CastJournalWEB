import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Flag, MessageSquare, Fish } from 'lucide-react';
import { moderationApi, reasonLabel, type ModerationItem } from '../../api/moderation';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { apiErrorMessage } from '../../utils/errorMessage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type Decision = { kind: 'dismiss' | 'remove'; item: ModerationItem; text: string };

/**
 * Review queue for reported content (FR-44, F-18). Admins decide; nothing is removed automatically.
 * Content is shown only while it's public — never a trip the author has since made private.
 */
export function Moderation() {
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const [items, setItems] = useState<{ tab: string; list: ModerationItem[] } | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (which: 'open' | 'closed') => {
    try {
      setItems({ tab: which, list: await moderationApi.queue(which) });
    } catch {
      setItems({ tab: which, list: [] });
      toast.error("Couldn't load reports.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    moderationApi
      .queue(tab)
      .then((list) => { if (!cancelled) setItems({ tab, list }); })
      .catch(() => { if (!cancelled) setItems({ tab, list: [] }); });
    return () => { cancelled = true; };
  }, [tab]);

  const list = items?.tab === tab ? items.list : null;

  const decide = async () => {
    if (!decision) return;
    const { kind, item, text } = decision;
    if (kind === 'remove' && text.trim().length < 3) {
      setError("Give a short reason; it's sent to the author.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (kind === 'remove') await moderationApi.remove(item.targetType, item.targetId, text.trim());
      else await moderationApi.dismiss(item.targetType, item.targetId, text.trim() || undefined);
      toast.success(kind === 'remove'
        ? item.targetType === 'Trip' ? 'Trip removed from the community. The angler was told why.' : 'Comment removed. The author was told why.'
        : 'Reports dismissed.');
      setDecision(null);
      load(tab);
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't save the decision."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-lg border border-border p-1 sm:w-fit">
        {(['open', 'closed'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn('rounded-md px-3 py-1 text-sm', tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            {t === 'open' ? 'Needs review' : 'Reviewed (90 days)'}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Anglers report published trips and comments here. <strong>Remove</strong> takes a trip off the community
        feed (it stays private in the angler's journal and can't be republished) or deletes a comment; the author is
        told why. <strong>Dismiss</strong> keeps it. Reporters are told the outcome but never named to the author.
      </p>

      {!list && <p className="text-muted-foreground">Loading…</p>}
      {list?.length === 0 && (
        <p className="text-muted-foreground">{tab === 'open' ? 'Nothing waiting for review.' : 'No reviewed reports in the last 90 days.'}</p>
      )}

      <div className="space-y-3">
        {list?.map((item) => (
          <div key={`${item.targetType}-${item.targetId}`} className="rounded-lg border border-border p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                {item.coverUrl && (
                  <img src={resolveMediaUrl(item.coverUrl)} alt="" className="size-16 shrink-0 rounded-md object-cover" />
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.targetType === 'Trip' ? <Fish className="size-4" /> : <MessageSquare className="size-4" />}
                    <strong>{item.targetType === 'Trip' ? 'Trip' : 'Comment'} by {item.authorName ?? 'unknown'}</strong>
                    <Badge variant="destructive"><Flag className="size-3" /> {item.reportCount}</Badge>
                    {item.status !== 'Open' && (
                      <Badge variant="secondary">{item.status === 'ContentRemoved' ? 'Removed' : 'Dismissed'}</Badge>
                    )}
                  </div>
                  {item.targetType === 'Comment' && item.tripTitle && (
                    <p className="m-0 text-xs text-muted-foreground">On “{item.tripTitle}”</p>
                  )}
                  {item.preview ? (
                    <p className="m-0 mt-1 line-clamp-3 whitespace-pre-line">{item.preview}</p>
                  ) : (
                    <p className="m-0 mt-1 italic text-muted-foreground">
                      No longer public — the author withdrew or deleted it, so its content isn't shown.
                    </p>
                  )}
                  {item.isStillPublic && (
                    <Link
                      to={`/trips/${item.tripId}${item.targetType === 'Comment' ? '#comments' : ''}`}
                      target="_blank"
                      className="text-xs underline"
                    >
                      Open {item.targetType === 'Trip' ? 'trip' : 'the trip'} in a new tab
                    </Link>
                  )}
                </div>
              </div>

              {item.status === 'Open' && (
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setError(null); setDecision({ kind: 'dismiss', item, text: '' }); }}>
                    Dismiss
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => { setError(null); setDecision({ kind: 'remove', item, text: '' }); }}>
                    Remove…
                  </Button>
                </div>
              )}
            </div>

            <ul className="m-0 mt-2 list-none space-y-0.5 border-t border-border p-0 pt-2 text-xs text-muted-foreground">
              {item.reports.map((r, i) => (
                <li key={i}>
                  <span className="font-medium text-foreground">{reasonLabel(r.reason)}</span>
                  {r.details && <> — “{r.details}”</>} · {r.reporterName ?? 'an angler'} · {new Date(r.createdAt).toLocaleDateString()}
                </li>
              ))}
              {item.reviewNote && <li className="pt-1">Decision note: {item.reviewNote}</li>}
            </ul>
          </div>
        ))}
      </div>

      <Dialog open={!!decision} onOpenChange={(o) => { if (!o) setDecision(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decision?.kind === 'remove'
                ? decision.item.targetType === 'Trip' ? 'Remove this trip from the community?' : 'Remove this comment?'
                : 'Dismiss these reports?'}
            </DialogTitle>
          </DialogHeader>
          {decision && (
            <div className="space-y-2 text-sm">
              <p className="m-0 text-muted-foreground">
                {decision.kind === 'remove'
                  ? decision.item.targetType === 'Trip'
                    ? "It leaves the feed and becomes private in the angler's journal; they can't publish it again. Your reason is sent to them."
                    : 'The comment is deleted. Your reason is sent to its author.'
                  : 'The content stays. Reporters are told it was reviewed and kept.'}
              </p>
              <Textarea
                rows={3}
                maxLength={500}
                value={decision.text}
                placeholder={decision.kind === 'remove' ? 'Reason (required), e.g. "Advertising for a shop"' : 'Note for the record (optional)'}
                onChange={(e) => setDecision({ ...decision, text: e.target.value })}
              />
              {error && <p className="m-0 text-destructive" role="alert">{error}</p>}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDecision(null)}>Cancel</Button>
            <Button type="button" variant={decision?.kind === 'remove' ? 'destructive' : 'default'} disabled={busy} onClick={decide}>
              {busy ? 'Saving…' : decision?.kind === 'remove' ? 'Remove' : 'Dismiss'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
