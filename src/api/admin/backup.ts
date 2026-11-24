import { api, downloadFile, uploadFile } from '../client';

export interface RestoreResult {
  speciesRestored: number;
  locationsRestored: number;
  categoriesRestored: number;
  tripsRestored: number;
  catchesRestored: number;
  commentsRestored: number;
  likesRestored: number;
  followsRestored: number;
  /** Accounts in the backup that still exist (left unchanged). */
  usersMatched: number;
  usersSkipped: number;
  /** Records already here (including deleted ones), left as they are. */
  alreadyPresent: number;
  warnings: string[];
}

export interface CleanupResult {
  deletedTripsPurged: number;
  deletedCatchesPurged: number;
  deletedLocationsPurged: number;
  mediaFilesDeleted: number;
  expiredTokensPurged: number;
  oldAuditLogsPurged: number;
}

/** System backup (FR-41). Backups are encrypted with the administrator's passphrase (M-12). */
export const backupApi = {
  export: (passphrase: string) => downloadFile('/backup/export', false, { passphrase }),
  restore: (file: File, passphrase: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('passphrase', passphrase);
    return uploadFile<RestoreResult>('/backup/restore', form);
  },
  cleanup: (deletedRetentionDays: number, auditLogRetentionDays: number) =>
    api.post<CleanupResult>(
      `/backup/cleanup?deletedRetentionDays=${deletedRetentionDays}&auditLogRetentionDays=${auditLogRetentionDays}`,
    ),
};
