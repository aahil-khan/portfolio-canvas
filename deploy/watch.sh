#!/usr/bin/env bash
# Deploys the site whenever `main` on GitHub moves. Run every minute by portfolio-watch.timer.
#
#   fetch origin/main → nothing new? exit
#   fast-forward the checkout → write .build-sha → stagectl deploy → drop the old image
#
# stagectl builds the new image while the old container keeps serving, so a failed build leaves
# the live site exactly as it was. Every run appends to $LOG.
#
# The whole body is in main(), called on the last line: the fast-forward below can replace this
# very file, and bash reads scripts as it goes — it must have parsed all of it before that.

main() {
    set -euo pipefail

    local app="${APP_DIR:-$HOME/staging/apps/portfolio-redesign}"
    local name="${APP_NAME:-portfolio-redesign}"
    local stagectl="${STAGECTL:-$HOME/staging/bin/stagectl}"
    local docker="${DOCKER:-docker}"
    local log="${LOG:-$HOME/.local/state/portfolio-watch.log}"
    mkdir -p "$(dirname "$log")"

    say() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" >>"$log"; }

    # one run at a time, however long a build takes
    exec 9>"$app/.watch.lock"
    flock -n 9 || exit 0

    cd "$app"
    if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
        say "refusing: tracked files changed by hand in $app — commit them to the repo instead"
        exit 1
    fi

    git fetch --quiet origin main
    local here there
    here="$(git rev-parse HEAD)"
    there="$(git rev-parse origin/main)"
    [[ "$here" == "$there" ]] && exit 0
    # a commit that failed to build is not retried every minute; the next push moves main past it
    [[ "$(cat .watch-failed 2>/dev/null)" == "$there" ]] && exit 0

    say "deploying ${there:0:7} (was ${here:0:7})"
    git merge --quiet --ff-only origin/main
    git rev-parse HEAD >.build-sha

    local old
    old="$($docker image inspect "stage-$name" --format '{{.Id}}' 2>/dev/null || true)"

    if ! "$stagectl" deploy "$name" >>"$log" 2>&1; then
        say "deploy of ${there:0:7} FAILED — the previous build is still serving"
        # step back, so the next run retries this commit instead of thinking it is done
        git reset --quiet --hard "$here"
        echo "$there" >.watch-failed
        exit 1
    fi

    local new
    new="$($docker image inspect "stage-$name" --format '{{.Id}}' 2>/dev/null || true)"
    # only ever this app's own previous image; `/` is tight, and nothing else here is ours to prune
    if [[ -n "$old" && "$old" != "$new" ]]; then
        $docker rmi "$old" >/dev/null 2>&1 || true
    fi
    rm -f .watch-failed
    say "live ${there:0:7}"
}

main "$@"
exit $?
