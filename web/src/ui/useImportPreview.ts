import { useCallback, useState } from "react";
import {
  applyBundleImport,
  planBundleImport,
  type BundleImportPlan,
  type ImportCounts,
} from "../data/exportImport";

export interface ImportPreviewFlow {
  plan: BundleImportPlan | null;
  error: string | null;
  /** Reads a bundle and works out what it would do. Nothing is written yet. */
  prepare: (text: string) => Promise<boolean>;
  /** Writes the plan. Returns the counts that were written. */
  apply: () => Promise<ImportCounts | null>;
  cancel: () => void;
}

/**
 * The import flow, shared by the Share screen and the backup file reader:
 * read the bundle, show what it would do, write it only when the tech says
 * yes.
 */
export function useImportPreview(): ImportPreviewFlow {
  const [plan, setPlan] = useState<BundleImportPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const prepare = useCallback(async (text: string) => {
    try {
      const next = await planBundleImport(text);
      setPlan(next);
      setError(null);
      return true;
    } catch (err) {
      setPlan(null);
      setError((err as Error).message);
      return false;
    }
  }, []);

  const apply = useCallback(async () => {
    if (!plan) return null;
    const totals = plan.preview.totals;
    await applyBundleImport(plan);
    setPlan(null);
    return totals;
  }, [plan]);

  const cancel = useCallback(() => setPlan(null), []);

  return { plan, error, prepare, apply, cancel };
}
