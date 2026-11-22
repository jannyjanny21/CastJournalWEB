import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { catchesApi } from '../../api/catches';
import { tripsApi } from '../../api/trips';

/**
 * A catch is shown on its trip's page, so /catches/:id just forwards there.
 * Kept so links shared before trips existed (and old notifications) still work:
 * when trips were introduced, each existing catch became a trip with the same ID.
 */
export function CatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function forward() {
      try {
        const c = await catchesApi.getById(id!);
        if (!cancelled) navigate(`/trips/${c.tripId}#catch-${c.id}`, { replace: true });
        return;
      } catch {
        // Not a catch you can see — maybe an old link whose ID is now a trip's.
      }
      try {
        const t = await tripsApi.getById(id!);
        if (!cancelled) navigate(`/trips/${t.id}`, { replace: true });
      } catch {
        if (!cancelled) setError('Catch not found.');
      }
    }

    forward();
    return () => { cancelled = true; };
  }, [id, navigate]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  return <p className="text-muted-foreground">Loading...</p>;
}
