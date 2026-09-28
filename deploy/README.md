# Deploying

The server runs whatever is on `main`. There is no deploy command any more.

```
push to main  ─┐
save in /edit ─┴→ GitHub main ──(within a minute)──→ aahil-server: portfolio-watch.timer
                                                      git pull → docker build → swap → live
```

- **Code changes:** push to `main` (or merge a PR). Live in ~3 minutes.
- **Content changes:** `/edit` on the site, or edit `content/data/*.json` and push.
- **Do not `stage deploy portfolio-redesign` from the laptop.** The server's copy is a git checkout
  now; an rsync over it would be refused by the watcher at best, and at worst overwrite edits made
  in the browser.

## Files

| File | What |
|---|---|
| `watch.sh` | Runs every minute. No-op unless `origin/main` moved. A build that fails leaves the old container serving and is not retried until the next push. |
| `portfolio-watch.{service,timer}` | The systemd user units that run it. |
| `setup.sh` | One-time: turns the rsynced directory into a checkout and installs the timer. Dry-run by default. |

## On the server

```bash
tail -f ~/.local/state/portfolio-watch.log         # what it did
systemctl --user list-timers portfolio-watch.timer # when it runs next
systemctl --user start portfolio-watch.service     # check now instead of in a minute
curl -s https://<site>/api/version                 # which commit is live
```

A failed build is logged with its commit and skipped until `main` moves again — push a fix.

## One-time setup

1. Merge this branch to `main`.
2. On the server: `cd ~/staging/apps/portfolio-redesign && bash <(curl -s https://raw.githubusercontent.com/aahil-khan/portfolio-canvas/main/deploy/setup.sh)`
   to preview, then the same with `--yes`. (The rsynced copy has the script too:
   `bash deploy/setup.sh`.)
3. Add the editor's secrets to `~/staging/apps/portfolio-redesign/.env.local` (see `.env.example`,
   `EDIT_*`), then `systemctl --user start portfolio-watch.service` after the next push, or
   `~/staging/bin/stagectl deploy portfolio-redesign` once to pick them up now.
