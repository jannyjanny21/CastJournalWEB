import { useState } from 'react';
import { toast } from 'sonner';
import { Lock, Upload, Trash2 } from 'lucide-react';
import { backupApi, type CleanupResult, type RestoreResult } from '../../api/admin/backup';
import { apiErrorMessage } from '../../utils/errorMessage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';

const MIN_PASSPHRASE = 10;

function save(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** System backup, restore and cleanup (FR-41, M-12). */
export function Backup() {
  // Export
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [exporting, setExporting] = useState(false);
  const exportProblem =
    passphrase.length > 0 && passphrase.length < MIN_PASSPHRASE
      ? `At least ${MIN_PASSPHRASE} characters.`
      : confirmPassphrase && confirmPassphrase !== passphrase
        ? "The passphrases don't match."
        : null;
  const canExport = passphrase.length >= MIN_PASSPHRASE && passphrase === confirmPassphrase && !exporting;

  const handleExport = async () => {
    setExporting(true);
    try {
      const { blob, fileName } = await backupApi.export(passphrase);
      save(blob, fileName);
      toast.success('Backup downloaded. Keep the passphrase somewhere safe — without it the file can’t be restored.');
      setPassphrase('');
      setConfirmPassphrase('');
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't create the backup."));
    } finally {
      setExporting(false);
    }
  };

  // Restore
  const [file, setFile] = useState<File | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const handleRestore = async () => {
    if (!file) return;
    if (!confirm('Restore this backup? Records that are missing here will be added back. Nothing that already exists is changed, and anything anglers deleted stays deleted.')) return;
    setRestoring(true);
    setRestoreError(null);
    setRestoreResult(null);
    try {
      setRestoreResult(await backupApi.restore(file, restorePassphrase));
      setRestorePassphrase('');
    } catch (err) {
      setRestoreError(apiErrorMessage(err, "Couldn't restore the backup."));
    } finally {
      setRestoring(false);
    }
  };

  // Cleanup
  const [retention, setRetention] = useState('30');
  const [auditRetention, setAuditRetention] = useState('365');
  const [cleaning, setCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);

  const handleCleanup = async () => {
    const days = Math.max(30, Number(retention) || 30);
    const auditDays = Math.max(30, Number(auditRetention) || 365);
    if (!confirm(`Permanently remove trips, catches and spots deleted more than ${days} days ago, with their photos and videos? This can't be undone.`)) return;
    setCleaning(true);
    try {
      setCleanupResult(await backupApi.cleanup(days, auditDays));
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Cleanup failed.'));
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lock className="size-4" /> Create a backup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="m-0 text-muted-foreground">
            Downloads every account's trips, catches, spots, comments and settings, including recently deleted
            items, as an encrypted file. Photos and videos aren't inside it; back up the uploads folder separately.
          </p>
          <div className="space-y-1">
            <Label htmlFor="bk-pass">Passphrase</Label>
            <PasswordInput id="bk-pass" value={passphrase} autoComplete="new-password" onChange={(e) => setPassphrase(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bk-pass2">Repeat passphrase</Label>
            <PasswordInput id="bk-pass2" value={confirmPassphrase} autoComplete="new-password" onChange={(e) => setConfirmPassphrase(e.target.value)} />
          </div>
          {exportProblem && <p className="m-0 text-destructive">{exportProblem}</p>}
          <p className="m-0 rounded-md border border-[color:var(--color-brass)]/40 bg-[color:var(--color-brass)]/10 p-2 text-xs">
            Store the passphrase somewhere safe, such as a password manager. It isn't saved anywhere, and without it
            the backup can't be restored. Anglers' private records stay unreadable to anyone holding only the file.
          </p>
          <Button onClick={handleExport} disabled={!canExport}>{exporting ? 'Preparing…' : 'Download encrypted backup'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="size-4" /> Restore a backup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="m-0 text-muted-foreground">
            Adds back records that are missing. Nothing that already exists is changed, so newer edits are kept and
            anything anglers deleted stays deleted. Records of accounts that no longer exist are skipped.
          </p>
          <p className="m-0 text-xs text-muted-foreground">
            Always restore the <strong>most recent</strong> backup: trips permanently removed by cleanup aren't here
            anymore, so an older backup would bring them back.
          </p>
          <div className="space-y-1">
            <Label htmlFor="rs-file">Backup file (.cjbackup)</Label>
            <Input id="rs-file" type="file" accept=".cjbackup,.json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rs-pass">Passphrase</Label>
            <PasswordInput id="rs-pass" value={restorePassphrase} autoComplete="off" onChange={(e) => setRestorePassphrase(e.target.value)} />
          </div>
          {restoreError && <p className="m-0 text-destructive" role="alert">{restoreError}</p>}
          <Button variant="outline" onClick={handleRestore} disabled={!file || restoring}>
            {restoring ? 'Restoring…' : 'Restore'}
          </Button>
          {restoreResult && (
            <div className="rounded-md border border-border p-2 text-xs">
              <p className="m-0 font-medium">Added back</p>
              <p className="m-0">
                {restoreResult.tripsRestored} trips · {restoreResult.catchesRestored} catches · {restoreResult.locationsRestored} spots ·{' '}
                {restoreResult.speciesRestored} species · {restoreResult.categoriesRestored} categories · {restoreResult.commentsRestored} comments ·{' '}
                {restoreResult.likesRestored} likes · {restoreResult.followsRestored} follows
              </p>
              <p className="m-0 text-muted-foreground">
                {restoreResult.alreadyPresent} records were already here and left unchanged.
              </p>
              {restoreResult.warnings.length > 0 && (
                <ul className="m-0 mt-1 list-disc pl-4 text-muted-foreground">
                  {restoreResult.warnings.slice(0, 10).map((w) => <li key={w}>{w}</li>)}
                  {restoreResult.warnings.length > 10 && <li>…and {restoreResult.warnings.length - 10} more</li>}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Trash2 className="size-4" /> Clean up</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="m-0 text-muted-foreground">
            Permanently removes trips, catches and spots that anglers deleted long ago (with their photos and videos),
            expired sign-in tokens and old audit logs. Anglers can restore deleted trips for 30 days, so cleanup never
            removes anything newer than that. Create a backup first.
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label htmlFor="cl-days">Deleted more than (days)</Label>
              <Input id="cl-days" type="number" min={30} className="w-32" value={retention} onChange={(e) => setRetention(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cl-audit">Audit logs older than (days)</Label>
              <Input id="cl-audit" type="number" min={30} className="w-32" value={auditRetention} onChange={(e) => setAuditRetention(e.target.value)} />
            </div>
            <Button variant="outline" onClick={handleCleanup} disabled={cleaning}>{cleaning ? 'Cleaning…' : 'Run cleanup'}</Button>
          </div>
          {cleanupResult && (
            <p className="m-0 text-xs">
              Removed {cleanupResult.deletedTripsPurged} trips, {cleanupResult.deletedCatchesPurged} catches,{' '}
              {cleanupResult.deletedLocationsPurged} spots, {cleanupResult.mediaFilesDeleted} files,{' '}
              {cleanupResult.expiredTokensPurged} expired tokens and {cleanupResult.oldAuditLogsPurged} audit logs.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
