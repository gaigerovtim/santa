#!/bin/bash
# Автосохранение: коммитит все изменения и пушит в origin.
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

git add -A
if ! git diff --cached --quiet; then
  files=$(git diff --cached --name-only | head -5 | tr '\n' ' ')
  git commit -q -m "Автосохранение: ${files}" -m "$(date '+%Y-%m-%d %H:%M:%S')"
fi

branch=$(git rev-parse --abbrev-ref HEAD)
if [ -n "$(git log "origin/$branch..HEAD" 2>/dev/null)" ] || ! git rev-parse --verify -q "origin/$branch" >/dev/null; then
  git push -q -u origin "$branch" 2>&1 || echo '{"systemMessage":"Автосохранение: push не удался, изменения закоммичены локально"}'
fi
exit 0
