import { useEffect, useState } from 'react';
import { speciesApi } from '../../api/species';
import type { Species, SpeciesStatus } from '../../types/species';
import { PageHeader } from '../../components/PageHeader';
import { RequestSpeciesLink } from '../../components/RequestSpeciesDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const statusVariant: Record<SpeciesStatus, 'default' | 'secondary' | 'destructive'> = {
  Approved: 'default',
  Pending: 'secondary',
  Rejected: 'destructive',
};

/** The angler's species requests and what happened to them (FR-42). */
export function MySpeciesRequests() {
  const [requests, setRequests] = useState<Species[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    speciesApi
      .getMyRequests()
      .then((r) => { if (!cancelled) setRequests(r); })
      .catch(() => { if (!cancelled) setError("Couldn't load your requests."); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="My species requests" />
      <RequestSpeciesLink />

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {!requests && !error && <p className="mt-4 text-muted-foreground">Loading…</p>}
      {requests?.length === 0 && (
        <p className="mt-4 text-muted-foreground">You haven't requested any species yet.</p>
      )}

      <div className="mt-4 space-y-3">
        {requests?.map((r) => (
          <Card key={r.id}>
            <CardContent className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <strong>
                  {r.commonName}
                  {r.scientificName && <span className="font-normal italic text-muted-foreground"> · {r.scientificName}</span>}
                </strong>
                <Badge variant={statusVariant[r.status]}>{r.status}</Badge>
              </div>
              <p className="m-0 text-xs text-muted-foreground">
                Requested {new Date(r.createdAt).toLocaleDateString()}
                {r.reviewedAt && <> · reviewed {new Date(r.reviewedAt).toLocaleDateString()}</>}
              </p>
              {r.status === 'Rejected' && r.rejectionReason && (
                <p className="m-0 text-sm"><strong>Reason:</strong> {r.rejectionReason}</p>
              )}
              {r.status === 'Approved' && (
                <p className="m-0 text-sm text-muted-foreground">You can now pick it when logging a catch.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
