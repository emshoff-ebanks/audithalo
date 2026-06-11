# Pushing to GitHub and Vercel

**Read this if you are about to commit or push from this repo.** If your push fails with `Repository not found`, you are almost certainly authenticated as the wrong account — fix it before retrying.

---

## The hard rule

> Never push or commit under any identity other than **`emshoff-ebanks`** (GitHub numeric ID `228783329`). The CI gate at `ci/forbidden-patterns.sh` blocks the strings of an old, unrelated personal-billing account that must not appear in AuditHalo's history.

All commits must show the GitHub-noreply email tied to `emshoff-ebanks`:

```
Author: emshoff-ebanks <228783329+emshoff-ebanks@users.noreply.github.com>
```

---

## How to commit (don't trust `git config`)

`git config user.email` can be silently overridden by global config or Git Credential Manager. **Always pass the identity per-command** with `-c` flags. This works regardless of what's in the user's global config:

```bash
git -c user.email="228783329+emshoff-ebanks@users.noreply.github.com" \
    -c user.name="emshoff-ebanks" \
    commit -m "your message"
```

For a multi-line commit message, use a HEREDOC:

```bash
git -c user.email="228783329+emshoff-ebanks@users.noreply.github.com" \
    -c user.name="emshoff-ebanks" \
    commit -m "$(cat <<'EOF'
docs: short title here

- bullet one
- bullet two
EOF
)"
```

---

## How to push

The remote is already correct:

```
origin  https://github.com/emshoff-ebanks/audithalo.git
```

Push the branch you committed on (almost always `main`):

```bash
git push origin main
```

No special flags needed. If this fails with `Repository not found` or `403`, your **credentials** are wrong, not the remote. See "Recovery" below.

---

## How Vercel gets the update

You do **not** run any Vercel CLI command to deploy. Vercel is connected to the GitHub repo and watches the `main` branch:

1. You `git push origin main`.
2. Vercel sees the push and triggers a build.
3. Both `audithalo.com` (marketing) and `app.audithalo.com` (app) deploy together. They are one Next.js codebase, routed by host.
4. The build takes 1–2 minutes. Check status at the Vercel dashboard for the `audithalo` project.

For docs-only commits, the build is essentially a no-op rebuild — fine to ship.

---

## Recovery: when push fails with auth/credential errors

Symptom: `remote: Repository not found.` or `fatal: Authentication failed` or a credential prompt that auto-fills the wrong GitHub account.

This means **Git Credential Manager has the wrong account cached**. Purge it on Windows:

```pwsh
git credential-manager github logout <stale-username>
cmdkey /delete:git:https://github.com
```

Then push again — Git will re-prompt for auth. Sign in as `emshoff-ebanks` (the user does this in the browser popup). On success the new credentials cache and future pushes work.

If `git credential-manager` is not on PATH, the second command alone (`cmdkey /delete:git:https://github.com`) is usually enough to force re-auth.

---

## Quick checklist before pushing

- [ ] `npm run build` passes
- [ ] `npx vitest run` passes (8 tests on the rule engine)
- [ ] You used `-c user.email=...@users.noreply.github.com -c user.name="emshoff-ebanks"` on the commit
- [ ] `git log -1 --format='%an <%ae>'` shows `emshoff-ebanks <228783329+emshoff-ebanks@users.noreply.github.com>`
- [ ] You're pushing the right branch (almost always `main`)

If all four are green, push. Vercel takes it from there.
