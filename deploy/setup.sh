#!/usr/bin/env bash
# One-time switch of the server's copy of the site from "rsynced from the laptop" to "a git
# checkout of main that deploys itself". Run ON aahil-server, after this branch is merged:
#
#   bash deploy/setup.sh          # shows what it would do
#   bash deploy/setup.sh --yes    # does it
#
# It never stops or rebuilds the running container — the site keeps serving the build it has
# until the next push to main.
set -euo pipefail

APP="${APP_DIR:-$HOME/staging/apps/portfolio-redesign}"
REPO="https://github.com/aahil-khan/portfolio-canvas.git"
UNITS="$HOME/.config/systemd/user"
BACKUP="$APP.pre-git-$(date +%Y%m%d-%H%M%S)"
GO=0; [[ "${1:-}" == "--yes" ]] && GO=1

step() { printf '\n\033[1m%s\033[0m\n' "$*"; }
run()  { printf '  $ %s\n' "$*"; if ((GO)); then "$@"; fi; }

if [[ -d "$APP/.git" ]]; then
    step "$APP is already a git checkout — skipping the move and clone"
else
    [[ -f "$APP/.env.local" ]] || { echo "no $APP/.env.local — refusing, the site's secrets would be lost"; exit 1; }
    step "1. Keep the rsynced copy aside (nothing is deleted)"
    run mv "$APP" "$BACKUP"
    step "2. Clone main in its place"
    run git clone --quiet --branch main "$REPO" "$APP"
    step "3. Carry the secrets over (.env.local is never in git)"
    run cp "$BACKUP/.env.local" "$APP/.env.local"
    run chmod 600 "$APP/.env.local"
fi

step "4. Install the watcher (a user timer, every minute)"
run mkdir -p "$UNITS"
run cp "$APP/deploy/portfolio-watch.service" "$APP/deploy/portfolio-watch.timer" "$UNITS/"
run systemctl --user daemon-reload
run systemctl --user enable --now portfolio-watch.timer

step "Done."
if ((GO)); then
    echo "  Log:    tail -f ~/.local/state/portfolio-watch.log"
    echo "  Status: systemctl --user list-timers portfolio-watch.timer"
    echo "  Old copy kept at: $BACKUP (delete it once a deploy has gone through)"
else
    echo "  Nothing was changed. Re-run with --yes to do the above."
fi
