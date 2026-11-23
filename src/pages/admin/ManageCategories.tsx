import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { contentCategoriesApi, type CategoryType, type ContentCategory } from '../../api/contentCategories';
import { apiErrorMessage } from '../../utils/errorMessage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const TYPES: { type: CategoryType; label: string; singular: string }[] = [
  { type: 'GearType', label: 'Gear', singular: 'gear type' },
  { type: 'Bait', label: 'Bait', singular: 'bait' },
  { type: 'FishingMethod', label: 'Methods', singular: 'fishing method' },
];

type Editing = { id: string | null; name: string; description: string };

/**
 * The lists anglers pick gear, bait and method from (FR-38, UC-25, F-25).
 * Values are deactivated rather than deleted: old catches keep what they recorded.
 */
export function ManageCategories() {
  const [active, setActive] = useState<CategoryType>('GearType');
  const [items, setItems] = useState<{ type: CategoryType; list: ContentCategory[] } | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (type: CategoryType) => {
    try {
      const list = await contentCategoriesApi.getAll(type, true);
      setItems({ type, list });
    } catch {
      setItems({ type, list: [] });
      toast.error("Couldn't load the list.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    contentCategoriesApi
      .getAll(active, true)
      .then((list) => { if (!cancelled) setItems({ type: active, list }); })
      .catch(() => { if (!cancelled) setItems({ type: active, list: [] }); });
    return () => { cancelled = true; };
  }, [active]);

  const meta = TYPES.find((t) => t.type === active)!;
  const list = items?.type === active ? items.list : null;

  const save = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (name.length < 2) {
      setError('Name must be at least 2 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = { name, description: editing.description.trim() || null };
      if (editing.id) await contentCategoriesApi.update(editing.id, { ...payload, description: payload.description ?? '' });
      else await contentCategoriesApi.create(active, payload);
      toast.success(editing.id ? 'Saved.' : `'${name}' added.`);
      setEditing(null);
      load(active);
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't save — try again."));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (c: ContentCategory) => {
    if (c.isActive && !confirm(`Deactivate '${c.name}'? Anglers won't be able to pick it for new catches; existing catches keep it.`)) return;
    try {
      await contentCategoriesApi.update(c.id, { isActive: !c.isActive });
      load(active);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't update — try again."));
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {TYPES.map((t) => (
            <button
              key={t.type}
              type="button"
              onClick={() => setActive(t.type)}
              className={cn(
                'rounded-md px-3 py-1 text-sm',
                active === t.type ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Button onClick={() => { setError(null); setEditing({ id: null, name: '', description: '' }); }}>
          + Add {meta.singular}
        </Button>
      </div>

      {!list && <p className="text-muted-foreground">Loading…</p>}
      {list?.length === 0 && <p className="text-muted-foreground">Nothing in this list yet.</p>}

      <div className="divide-y divide-border rounded-lg border border-border">
        {list?.map((c) => (
          <div key={c.id} className={cn('flex flex-wrap items-center justify-between gap-3 p-3', !c.isActive && 'opacity-60')}>
            <div className="min-w-0 text-sm">
              <strong>{c.name}</strong>
              {!c.isActive && <Badge variant="secondary" className="ml-2">Inactive</Badge>}
              {c.description && <p className="m-0 text-muted-foreground">{c.description}</p>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm"
                onClick={() => { setError(null); setEditing({ id: c.id, name: c.name, description: c.description ?? '' }); }}>
                Edit
              </Button>
              <Button variant="outline" size="sm" onClick={() => toggleActive(c)}>
                {c.isActive ? 'Deactivate' : 'Reactivate'}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? `Edit ${meta.singular}` : `New ${meta.singular}`}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3 text-sm">
              <div className="space-y-1">
                <Label htmlFor="cat-name">Name *</Label>
                <Input id="cat-name" value={editing.name} maxLength={100}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cat-desc">Description</Label>
                <Textarea id="cat-desc" rows={2} maxLength={500} value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              {editing.id && (
                <p className="text-xs text-muted-foreground">
                  Renaming affects new catches only; catches already logged keep the old name.
                </p>
              )}
              {error && <p className="text-destructive" role="alert">{error}</p>}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="button" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
