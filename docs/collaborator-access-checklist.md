# Collaborator Access Checklist

Steps to give a new collaborator (e.g. a teammate or co-developer) full access to code, deploy, and work on FoodMirror via Claude Code.

All steps in this checklist are performed by the project owner in external dashboards — nothing here requires code changes.

---

## 1. GitHub Access

1. Go to `github.com/yavleninma/foodmirror` > **Settings** > **Collaborators and teams** > **Add people**
2. Search by the collaborator's GitHub username or email
3. Select role **Write** — allows pushing branches and creating PRs; Admin is not needed
4. Click **Add to repository**
5. The collaborator receives an email invitation — they must accept it before they can push

---

## 2. Vercel Access

**If the project is under a Vercel Team:**
1. Vercel dashboard > Team Settings > **Members** > **Invite Member**
2. Enter their email, select role **Member** (can deploy, view logs, read env vars)
3. They receive an email invite to accept

**If the project is under a personal Vercel account (free tier):**
Vercel free tier does not support per-project collaborators on personal accounts. Options:
- Upgrade to **Vercel Pro** and convert to a team (recommended for shared projects)
- The collaborator creates their own Vercel account, links the same GitHub repo, and manages their own deployments (less ideal — two separate production environments)

Once the collaborator has Vercel access, they can read all environment variable values directly from the Vercel dashboard under **Project > Settings > Environment Variables**. This is the safest way to share secrets.

---

## 3. Sharing Environment Variables Securely

Do **not** share secrets via chat history, email in plaintext, or git commits.

Recommended options:
- **Vercel dashboard** — once they have Vercel access, they can read values themselves (best option)
- **Password manager with sharing** — 1Password, Bitwarden shared vault, etc.
- **One-time secret service** — e.g. `onetimesecret.com` (link expires after one view)
- **Telegram self-destructing message** — use the "set a timer" option on a message

The four required values are listed in `.env.example`:
- `OPENAI_API_KEY`
- `REDIS_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`

---

## 4. Collaborator Local Setup

Once they have GitHub access and the env var values, they run:

```bash
git clone git@github.com:yavleninma/foodmirror.git
cd foodmirror
cp .env.example .env
# fill in .env values
npm install
npm start
```

See `CLAUDE.md` for full local development details.

---

## 5. Vercel Auto-Deploy Setup (one-time, owner does this)

Connect the GitHub repo to Vercel so every push to `main` triggers a production deploy automatically, and every other branch gets a preview URL.

1. Vercel dashboard > your project > **Settings** > **Git**
2. Click **Connect Git Repository** > select `yavleninma/foodmirror`
3. Set **Production Branch** to `main`
4. Enable **Preview Deployments** for other branches (optional but recommended — every PR gets its own preview URL for testing)
5. Click **Save**

After this is set up:
- `git push origin main` → production deploy triggers automatically
- `git push origin feature-branch` → preview deploy triggers automatically
- No manual `vercel --prod` needed for routine deployments

---

## 6. Telegram Webhook (if domain changes)

If the Vercel project URL changes (e.g. after connecting a custom domain), re-register the Telegram webhook. See `docs/launch-checklist-ru.md` for the exact command.

---

## Done

Once steps 1–5 are complete, the collaborator can:
- Clone the repo and run locally
- Push branches and open PRs
- Use Claude Code with full project context (via `CLAUDE.md`)
- Deploy to production by merging to `main`
- View logs and env vars in the Vercel dashboard
