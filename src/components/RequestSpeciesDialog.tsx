import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { speciesApi } from '../api/species';
import { apiErrorMessage } from '../utils/errorMessage';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/**
 * "Species not listed? Request it" (FR-42, UC-32). The request waits for an administrator;
 * the angler gets a notification when it's approved or rejected.
 */
export function RequestSpeciesLink() {
  const [open, setOpen] = useState(false);
  const [commonName, setCommonName] = useState('');
  const [scientificName, setScientificName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setCommonName('');
    setScientificName('');
    setDescription('');
    setError(null);
  };

  const submit = async () => {
    if (commonName.trim().length < 2) {
      setError('Enter the common name (at least 2 characters).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await speciesApi.request({
        commonName: commonName.trim(),
        scientificName: scientificName.trim() || undefined,
        description: description.trim() || undefined,
      });
      toast.success("Request sent. You'll get a notification when an administrator reviews it.");
      reset();
      setOpen(false);
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't send the request — try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 text-xs text-muted-foreground underline hover:text-foreground"
      >
        Species not listed? Request it
      </button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request a species</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              An administrator checks each request before it's added to the list. Until then, you can
              save this catch with the closest species and edit it once yours is approved.
            </p>
            <div className="space-y-1">
              <Label htmlFor="req-common">Common name *</Label>
              <Input id="req-common" value={commonName} maxLength={100} onChange={(e) => setCommonName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="req-sci">Scientific name</Label>
              <Input id="req-sci" value={scientificName} maxLength={150} onChange={(e) => setScientificName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="req-desc">Notes for the administrator</Label>
              <Textarea
                id="req-desc"
                rows={3}
                maxLength={500}
                placeholder="Local names, where you caught it, how to tell it apart…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            {error && <p className="text-destructive" role="alert">{error}</p>}
            <p className="text-xs text-muted-foreground">
              <Link to="/species/requests" className="underline" onClick={() => setOpen(false)}>See your requests</Link>
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" onClick={submit} disabled={busy}>{busy ? 'Sending…' : 'Send request'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
