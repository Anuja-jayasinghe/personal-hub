# Backups

The free Supabase plan keeps no downloadable backups, so this app has its own: one command makes a single `.zip` of **all your data**, and another puts it back. Both are plain Node scripts and work the same on macOS and Windows (PowerShell).

> **A backup contains your real data** (bills, insurance documents, photos, notes). It is git-ignored (`backups/`), and it must never be committed, pasted into an issue, or uploaded anywhere you would not put the originals.

## Make a backup

```bash
pnpm backup
```

This writes `backups/personal-hub-YYYYMMDD-HHMMSS.zip` and prints something like:

```
  table tasks: 12 rows
  ...
Backup written and verified: backups/personal-hub-20261113-150811.zip
  4 tables, 31 rows, 9 files, 4.2 MB
```

To save it somewhere else (for example an external drive): `pnpm backup --out D:\Backups`.

What is inside the zip:

| Entry | Content |
|---|---|
| `manifest.json` | When it was made, row and file counts, and a SHA-256 checksum of every entry |
| `data/<table>.json` | Every row of every table in the `public` schema |
| `files/attachments/...` | Every uploaded file, at its original path |

What it does **not** contain: your `.env.local` secrets, the database structure (that comes from the migrations in `drizzle/`), and anything outside the app's own tables and bucket.

How it protects you:

- It only **reads** from Supabase and never overwrites an earlier backup.
- It writes to a `.part` file first, re-reads the finished zip, checks every checksum, and checks that no rows changed while it ran. Only then does it keep the file. If anything is wrong it deletes the partial file and tells you.

## How often, and where to keep copies

- Take one **after you add anything important** (a new vehicle's papers, a renewed insurance document) and at least **once a month**.
- Take one **before** applying a database migration (`pnpm db:migrate`) or doing anything risky.
- Keep at least one copy **outside this computer**, on a disk or a service you already trust with this kind of data, ideally on an encrypted disk (FileVault on the Mac, BitLocker on Windows). Treat the zip like a bank statement.
- Old backups are not deleted for you; delete the ones you no longer need.
- How backups get *triggered* beyond this command (a scheduled job or an in-app button) is still undecided: see issue #1.

## Restore a backup

```bash
pnpm backup:restore backups/personal-hub-20261113-150811.zip --dry-run   # look first, change nothing
pnpm backup:restore backups/personal-hub-20261113-150811.zip             # do it
```

The restore:

1. checks the zip against its manifest and refuses a damaged or edited file, naming the bad entry;
2. **refuses to run if the database or the file bucket already has anything in it** (it prints what it found);
3. uploads the files, then puts all rows back in one database transaction;
4. re-reads everything and confirms the database and files match the backup exactly.

### Replacing existing data on purpose

If the target is not empty and you really want to replace it, add `--wipe`. That **permanently deletes** every row and file in the target first, so it asks you to type `wipe personal-hub` (or pass `--confirm "wipe personal-hub"` in a script). Use it only when you mean it.

### Restoring into a brand-new Supabase project

1. Create the project and put its details in `.env.local` (see `SETUP.md`).
2. `pnpm db:migrate` (creates the tables) and `pnpm storage:setup` (creates the private bucket).
3. `pnpm setup:check`, then `pnpm backup:restore <file.zip>`.

The restore refuses to start if the database has fewer migrations applied than the backup was made with, or lacks a table that the backup has.

## Good to know

- The restore reads the whole zip into memory, which is fine for personal-sized data (the free plan allows 1 GB of files in total; very large backups need a computer with enough free memory).
- Tables are restored in alphabetical order. Today no table has foreign keys; if one is added later, the restore will need to order tables by their dependencies (note this in the pull request that adds the first foreign key).
- Dates are read and written in UTC, so a backup made on one computer restores identically on another.
- Tested end to end (issue #4): a backup of test data was deleted and restored, and the database rows and file bytes matched exactly; a second backup produced identical checksums.
