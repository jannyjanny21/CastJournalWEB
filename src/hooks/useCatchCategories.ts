import { useEffect, useState } from 'react';
import { contentCategoriesApi } from '../api/contentCategories';

export interface CatchCategoryOptions {
  gear: string[];
  bait: string[];
  method: string[];
}

/** Loads the active gear, bait and method categories once for a catch form. */
export function useCatchCategories(): CatchCategoryOptions {
  const [options, setOptions] = useState<CatchCategoryOptions>({ gear: [], bait: [], method: [] });

  useEffect(() => {
    let cancelled = false;
    contentCategoriesApi.getAll()
      .then((all) => {
        if (cancelled) return;
        const names = (type: string) =>
          all.filter((c) => c.type === type && c.isActive).map((c) => c.name).sort((a, b) => a.localeCompare(b));
        setOptions({ gear: names('GearType'), bait: names('Bait'), method: names('FishingMethod') });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return options;
}
