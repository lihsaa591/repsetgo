# Branching, Deploys, and Releases

## Branches

- `development` — day-to-day work happens here. Pushing to it deploys a
  **preview** build on Vercel (its own URL, doesn't touch production).
- `master` — the production branch. Merging into it triggers a
  **production** deploy to [myrepsetgo.vercel.app](https://myrepsetgo.vercel.app).

```
development  → commit, push (preview deploy)
             → merge into master when ready to ship
master       → production deploy happens automatically
```

## Versioning

The app follows [Semantic Versioning](https://semver.org): `MAJOR.MINOR.PATCH`.

- **PATCH** (`1.0.0` → `1.0.1`) — bug fixes, small tweaks
- **MINOR** (`1.0.0` → `1.1.0`) — new features, backwards-compatible
- **MAJOR** (`1.0.0` → `2.0.0`) — breaking changes (rare for this app)

The current version lives in `package.json`'s `"version"` field, and each
release gets a matching git tag (`v1.0.0`) and a GitHub Release with notes.

Releases and deploys are intentionally **decoupled** — merging to `master`
always deploys, regardless of whether you tag a release that day. Tags are
for tracking version history and writing changelogs, not for gating what
goes live. (Worth revisiting if this ever needs a manual approval step
before production — see the note in `git log` around when this was set up.)

## Cutting a release

Once `development` is merged into `master` and the deploy looks good:

```bash
git checkout master
git pull origin master

# Bumps package.json's version, commits, and creates the git tag —
# pick patch/minor/major based on what changed (see Versioning above)
npm version patch   # or: minor / major

# Push the version-bump commit and the new tag together
git push --follow-tags

# Publish the GitHub Release (opens notes in $EDITOR, or pass --notes)
gh release create v1.0.1 --target master --title "v1.0.1" --notes "..."

# Keep development in sync with the version bump
git checkout development
git merge master
git push origin development
```

## Why this setup

- **Vercel auto-deploy on `master`** means shipping is just "merge and
  it's live" — no separate deploy step to remember or forget.
- **GitHub Releases as a changelog** gives a readable version history
  without adding a manual gate in front of every deploy — appropriate for
  a solo project where deploy risk is low. If this app gets other people
  depending on its uptime, revisit gating production deploys behind a
  published release instead of every push to `master`.
