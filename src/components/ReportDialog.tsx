import { useState } from 'react';
import { Flag } from 'lucide-react';
import { toast } from 'sonner';
import { moderationApi, REPORT_REASONS, type ReportReason, type ReportTargetType } from '../api/moderation';
import { apiErrorMessage } from '../utils/errorMessage';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

/**
 * "Report" for a published trip or a comment (FR-44, F-18). An administrator reviews it;
 * nothing changes automatically.
 */
export function ReportButton({
  targetType,
  targetId,
  className,
}: {
  targetType: ReportTargetType;
  targetId: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? 'inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive'}
      >
        <Flag className="size-3.5" /> Report
      </button>
      {open && <ReportDialog targetType={targetType} targetId={targetId} onClose={() => setOpen(false)} />}
    </>
  );
}

/** The report form on its own, for opening from a menu (e.g. the ⋯ on a feed card). Mounted only while open. */
export function ReportDialog({
  targetType,
  targetId,
  onClose,
}: {
  targetType: ReportTargetType;
  targetId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = onClose;

  const submit = async () => {
    if (!reason) return;
    if (reason === 'Other' && !details.trim()) {
      setError("Tell us briefly what's wrong.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await moderationApi.report(targetType, targetId, reason, details.trim() || undefined);
      toast.success("Thanks for reporting. An administrator will review it, and we'll let you know.");
      close();
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't send the report — try again."));
    } finally {
      setBusy(false);
    }
  };

  const what = targetType === 'Trip' ? 'trip' : 'comment';

  return (
    <>
      <Dialog open onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report this {what}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="m-0 text-muted-foreground">
              What's wrong with it? An administrator will review your report. The author isn't told who reported it.
            </p>
            <fieldset className="space-y-1.5">
              {REPORT_REASONS.map((r) => (
                <label key={r.value} className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 hover:bg-muted">
                  <input
                    type="radio"
                    name="report-reason"
                    className="mt-1"
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                  />
                  <span>
                    <span className="block font-medium">{r.label}</span>
                    <span className="text-xs text-muted-foreground">{r.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            {reason && (
              <Textarea
                rows={2}
                maxLength={500}
                value={details}
                placeholder={reason === 'Other' ? "What's wrong? (required)" : 'Anything else the administrator should know? (optional)'}
                onChange={(e) => setDetails(e.target.value)}
              />
            )}
            {error && <p className="m-0 text-destructive" role="alert">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={submit} disabled={!reason || busy}>
              {busy ? 'Sending…' : 'Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
