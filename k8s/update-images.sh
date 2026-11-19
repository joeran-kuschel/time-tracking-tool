#!/bin/bash
# Imports the two freshly built images into the cluster node, restarts the deployments and then removes the previous
# copies of these two images from the node. Build them first (`docker build -t time-tracking-backend:latest ./backend`
# and the same for the frontend, see README.md).
#
# Why the cleanup is needed: importing a new build under the same tag moves the tag. The old image stays on the node as a
# bare `sha256:<id>` reference that still holds its layers, so every rebuild leaves about 290 MB behind. Such a copy
# carries no name, so only the digests that the two tags had before the import are removed, and nothing else: the node
# is shared with other apps. The copies are removed after the rollout, because a pod that restarts during it can still
# need the old image (`imagePullPolicy: Never`).
set -euo pipefail
source "$(dirname "$0")/db-common.sh"
# Not called NODE: npm sets that variable to the path of the node binary.
NODE_CONTAINER="${NODE_CONTAINER:-desktop-control-plane}"
ROLLOUT_TIMEOUT="${ROLLOUT_TIMEOUT:-180s}"
IMAGES=(time-tracking-backend time-tracking-frontend)
DEPLOYMENTS=(backend frontend)

node_ctr() { docker exec "$NODE_CONTAINER" ctr --namespace k8s.io "$@"; }
# The import reads the image from stdin, which `docker exec` passes on only with -i.
node_import() { docker exec -i "$NODE_CONTAINER" ctr --namespace k8s.io images import -; }

# digests_of <listing>: the digests that the tags of this project's images have in a `ctr images ls` listing.
digests_of() {
  local image
  for image in "${IMAGES[@]}"; do
    printf '%s\n' "$1" | awk -v ref="docker.io/library/$image:latest" '$1 == ref {print $3}'
  done
}

# orphan_refs <digest>...: `ctr images ls` on stdin; prints the references without a tag (`sha256:<id>` or
# `<name>@sha256:<digest>`) whose digest is one of those given and which no tagged reference shares.
orphan_refs() {
  awk -v digests=" $* " '
    NR > 1 {
      name[NR] = $1; digest[NR] = $3
      if ($1 !~ /^sha256:/ && $1 !~ /@sha256:/) tagged[$3] = 1
    }
    END {
      for (i in name) if (name[i] ~ /^sha256:|@sha256:/ && index(digests, " " digest[i] " ") && !tagged[digest[i]]) print name[i]
    }'
}

old_digests="$(digests_of "$(node_ctr images ls 2>/dev/null || true)" | tr '\n' ' ')"

for image in "${IMAGES[@]}"; do
  echo "Importing $image:latest into the node ..."
  docker save "$image:latest" | node_import >/dev/null
done

echo "Restarting the deployments ..."
kubectl --context "$KUBE_CONTEXT" -n "$NAMESPACE" rollout restart "${DEPLOYMENTS[@]/#/deployment/}"
for deployment in "${DEPLOYMENTS[@]}"; do
  if ! kubectl --context "$KUBE_CONTEXT" -n "$NAMESPACE" rollout status "deployment/$deployment" --timeout="$ROLLOUT_TIMEOUT"; then
    echo "The rollout of $deployment did not finish. The previous images stay on the node for a rollback." >&2
    exit 1
  fi
done

# From here on nothing fails the update: a leftover copy only costs disk space.
removed=0
if [ -n "${old_digests// /}" ]; then
  # shellcheck disable=SC2086 # the digests are words
  while IFS= read -r ref; do
    [ -n "$ref" ] || continue
    if node_ctr images rm --sync "$ref" >/dev/null 2>&1; then
      echo "Removed the previous copy $ref from the node."
      removed=$((removed + 1))
    else
      echo "Warning: could not remove $ref from the node." >&2
    fi
  done < <(node_ctr images ls 2>/dev/null | orphan_refs $old_digests || true)
fi
echo "Done: the new images are running, $removed previous cop$([ "$removed" = 1 ] && echo y || echo ies) removed from the node."
free="$(docker exec "$NODE_CONTAINER" df -h /var 2>/dev/null | awk 'NR==2 {print $4 " free (" $5 " used)"}' || true)"
[ -z "$free" ] || echo "The node has $free on /var."
exit 0
