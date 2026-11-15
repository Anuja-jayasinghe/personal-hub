# Setting up a new computer

These steps get the app running on a second computer (written for the **Windows laptop**, using PowerShell and `winget`; a macOS note is at the end). Both computers use the same Supabase database and file storage, so data you add on one shows up on the other. Only the code and your secret settings are per-computer.

You will need two secret values that are **not** in git:

| Secret | Where to get it |
|---|---|
| Database password | On the Mac, line `SUPABASE_DB_PASSWORD=` in `.env.local`. Copy it yourself into your password manager (Bitwarden). It cannot be read back from Supabase, only reset. |
| Supabase secret key | Supabase dashboard → project `personal-hub` → Project Settings → **API Keys** → *Secret keys* → `default` → reveal and copy. (On the Mac you can also run `supabase projects api-keys --reveal`.) |

Never paste these into chat, an issue, a pull request or a commit.

## 1. Install the tools

In PowerShell:

```powershell
winget install --id Git.Git --exact
winget install --id GitHub.cli --exact
winget install --id OpenJS.NodeJS.LTS --exact
winget install --id pnpm.pnpm --exact
```

Close PowerShell and open a new window, then check:

```powershell
node -v    # must be v22 or newer
pnpm -v    # 10.x
git --version
```

If `winget` has no `pnpm.pnpm`, use `npm install -g pnpm@10.11.0` instead.

## 2. Get the code

```powershell
gh auth login        # skip if you are already logged in
gh repo clone Anuja-jayasinghe/personal-hub C:\gitprojects\personal-hub
cd C:\gitprojects\personal-hub
pnpm install
```

Keep the project **outside** OneDrive-synced folders (`C:\gitprojects` is fine): a synced `node_modules` and `.env.local` cause trouble.

## 3. Create `.env.local`

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

Fill in these lines (the project ref is `qfhwazfnentlweackpqa`):

```
DATABASE_URL=postgresql://postgres.qfhwazfnentlweackpqa:<database-password>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
SUPABASE_DB_PASSWORD=<database-password>
SUPABASE_URL=https://qfhwazfnentlweackpqa.supabase.co
SUPABASE_SECRET_KEY=<secret key from the dashboard>
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<publishable key from the Clerk dashboard, API keys page>
CLERK_SECRET_KEY=<secret key from the Clerk dashboard, API keys page>
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
ALLOWED_EMAILS=<your email address>
```

The last five lines are the login (Phase 4.1). The app stays closed until `ALLOWED_EMAILS` is set, and only a signed-in person whose email is on that list gets in. Copy the two Clerk keys from this Mac's `.env.local` or from the Clerk dashboard yourself; never paste them into chat, an issue or a commit.

Replace the `<...>` parts, including the angle brackets. `.env.local` is git-ignored and must never be committed.

## Login (Clerk), one time only

The hub only opens for people on `ALLOWED_EMAILS` who are signed in with Clerk. Set this up once, on any computer (the dashboard names below may differ slightly):

1. Create a free account at <https://clerk.com> and a new application (the development instance is fine for local use). Turn on **Email code** and **Google** as sign-in methods.
2. In the dashboard's **Access mode** page, choose **Invite-only**, then add yourself under **Users** (create or invite your own email address). Clerk's allowlist is a paid feature in production, which is why the app has its own `ALLOWED_EMAILS` list.
3. On the **API keys** page, copy the publishable key and the secret key into `.env.local` yourself (see step 3 above). Never paste them into chat, an issue or a commit.
4. Put your email address in `ALLOWED_EMAILS`, restart the app, and sign in at `/sign-in`.

## 4. Check everything

```powershell
pnpm setup:check
```

You want every line to say `PASS`. The script never prints your secrets, and each `FAIL` says how to fix it. Common ones:

| Message | Meaning |
|---|---|
| `password authentication failed` | The database password is wrong. Copy it again. |
| `no tenant identifier` / `Tenant or user not found` | The user in `DATABASE_URL` must be `postgres.qfhwazfnentlweackpqa`. |
| `EHOSTUNREACH` / direct host warning | You used the direct database address, which needs IPv6. Use the pooler address above. |
| `storage rejected the key` / `Invalid Compact JWS` | `SUPABASE_SECRET_KEY` is wrong. Copy the `default` secret key again. |
| `migrations applied: 1 of 2` | Someone added a database change. Run `pnpm db:migrate` once (on either computer). |
| `Login is not set up yet` (in the browser) | `ALLOWED_EMAILS` is empty or missing in `.env.local`. Add your address and restart the app. |
| `This account is not allowed` (in the browser) | You signed in with an email that is not on `ALLOWED_EMAILS`. Sign out and use the right one. |
| `.env.local not found` | Run the command from the project folder, and make sure the file is named exactly `.env.local`. |

## 5. Run the app

```powershell
pnpm dev --port 3100
```

Open <http://localhost:3100>. The first time, Windows Firewall asks whether to allow Node.js: choose **Private networks** if you want to open the app from your phone on the home Wi-Fi (find the laptop's address with `ipconfig`, then browse to `http://<that address>:3100`). The app has no login yet, so anyone on that network can use it.

## 6. Prove the two computers share data

Add a task on **Tasks & notes** on one computer, then reload the page on the other. It should appear there.

## Working on both computers

- Start work with `git pull`; finish by committing and pushing. Work is tracked as GitHub issues and pull requests (see `CLAUDE.md`).
- After pulling, run `pnpm install` if `package.json` changed, and `pnpm setup:check` to see whether a database migration is waiting.
- A database migration is applied **once** (`pnpm db:migrate`), from whichever computer you are on; it changes the shared database for both.
- The repo uses LF line endings (`.gitattributes`), so Windows will not rewrite every file.

## macOS or Linux

Install Node 22+ and pnpm (for example with Homebrew: `brew install node pnpm`), then follow steps 2 to 6 with `cp .env.example .env.local` instead of `Copy-Item`.

## Backups

`pnpm backup` makes one zip of all your data and files, and `pnpm backup:restore` puts it back. See **[BACKUP.md](BACKUP.md)** for how often to back up, where to keep copies and how to restore. Backups contain your real data: keep them out of git. The free Supabase plan has no downloadable backups of its own.
