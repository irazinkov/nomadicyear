#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

# Optional local secrets file (ignored by git):
#   ENV_FILE=.env.r2 ./scripts/upload-r2-media.sh
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env.r2}"
if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

: "${R2_ACCESS_KEY_ID:?Missing R2_ACCESS_KEY_ID}"
: "${R2_SECRET_ACCESS_KEY:?Missing R2_SECRET_ACCESS_KEY}"
: "${R2_ACCOUNT_ID:?Missing R2_ACCOUNT_ID}"
: "${R2_BUCKET:?Missing R2_BUCKET}"

SRC_DIR="${1:-${ROOT_DIR}/public/uploads}"
DEST_PREFIX="${2:-uploads}" # Keep `uploads` to preserve existing /uploads/... URLs.
DRY_RUN="${DRY_RUN:-true}"
DELETE_REMOTE="${DELETE_REMOTE:-false}"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI not found. Install AWS CLI v2 first."
  exit 1
fi

if [[ ! -d "${SRC_DIR}" ]]; then
  echo "Source directory does not exist: ${SRC_DIR}"
  exit 1
fi

export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION="auto"

ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
DEST="s3://${R2_BUCKET}/${DEST_PREFIX}"

cmd=(
  aws s3 sync
  "${SRC_DIR}"
  "${DEST}"
  --endpoint-url "${ENDPOINT}"
  --exact-timestamps
  --no-progress
  --exclude ".DS_Store"
)

if [[ "${DELETE_REMOTE}" == "true" ]]; then
  cmd+=(--delete)
fi

if [[ "${DRY_RUN}" == "true" ]]; then
  cmd+=(--dryrun)
fi

echo "Syncing:"
echo "  source: ${SRC_DIR}"
echo "  dest:   ${DEST}"
echo "  dryrun: ${DRY_RUN}"
echo "  delete: ${DELETE_REMOTE}"

"${cmd[@]}"

echo "Done."
