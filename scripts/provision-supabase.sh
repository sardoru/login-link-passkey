#!/usr/bin/env bash
# Provision a Supabase project for login-link-passkey via the Management API.
# Creates (or reuses) a project, applies the auth migration, and prints the env
# values you need. Requires a Supabase *Management* access token (sbp_...).
#
# Usage:
#   SUPABASE_ACCESS_TOKEN=sbp_xxx ./provision-supabase.sh <project-name> [region] [org_id]
#
# Outputs (stdout, last block) KEY=VALUE lines for .env.local / your host:
#   SUPABASE_URL=...
#   SUPABASE_SERVICE_ROLE_KEY=...
set -euo pipefail

NAME="${1:?project name required}"
REGION="${2:-us-east-2}"
ORG_ID="${3:-}"
TOKEN="${SUPABASE_ACCESS_TOKEN:?set SUPABASE_ACCESS_TOKEN (sbp_...)}"
API="https://api.supabase.com/v1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILES=(
  "$SCRIPT_DIR/../templates/supabase/0001_auth.sql"
  "$SCRIPT_DIR/../templates/supabase/0002_admin.sql"
  "$SCRIPT_DIR/../templates/supabase/0003_passkeys.sql"
)
auth=(-H "Authorization: Bearer $TOKEN")

jqpy() { python3 -c "import sys,json;$1" ; }

if [ -z "$ORG_ID" ]; then
  ORG_ID=$(curl -s "${auth[@]}" "$API/organizations" | jqpy "print(json.load(sys.stdin)[0]['id'])")
  echo ">> using organization $ORG_ID" >&2
fi

# Reuse an existing project of the same name, else create one.
REF=$(curl -s "${auth[@]}" "$API/projects" | jqpy "print(next((p['id'] for p in json.load(sys.stdin) if p['name']=='$NAME'),''))")
if [ -n "$REF" ]; then
  echo ">> reusing existing project '$NAME' ($REF)" >&2
else
  DB_PASS="llp-$(openssl rand -hex 12)"
  REF=$(curl -s -X POST "${auth[@]}" -H "Content-Type: application/json" "$API/projects" \
    -d "{\"name\":\"$NAME\",\"organization_id\":\"$ORG_ID\",\"region\":\"$REGION\",\"db_pass\":\"$DB_PASS\"}" \
    | jqpy "print(json.load(sys.stdin).get('id',''))")
  [ -n "$REF" ] || { echo "!! project creation failed" >&2; exit 1; }
  echo ">> created project '$NAME' ($REF); db password: $DB_PASS  (save it)" >&2
fi

# Wait until healthy.
echo -n ">> waiting for project to become healthy" >&2
for _ in $(seq 1 60); do
  STATUS=$(curl -s "${auth[@]}" "$API/projects/$REF" | jqpy "print(json.load(sys.stdin).get('status',''))")
  [ "$STATUS" = "ACTIVE_HEALTHY" ] && break
  echo -n "." >&2; sleep 5
done
echo " $STATUS" >&2

# Apply migrations in order (0001 auth, 0002 admin/RBAC/invites/codes/waitlist, 0003 passkey management).
for SQL_FILE in "${SQL_FILES[@]}"; do
  [ -f "$SQL_FILE" ] || { echo "!! missing $SQL_FILE" >&2; exit 1; }
  echo ">> applying $(basename "$SQL_FILE")" >&2
  PAYLOAD=$(python3 -c "import json;print(json.dumps({'query':open('$SQL_FILE').read()}))")
  RESP=$(curl -s -X POST "${auth[@]}" -H "Content-Type: application/json" "$API/projects/$REF/database/query" -d "$PAYLOAD")
  echo "$RESP" | grep -qi 'error' && { echo "!! migration error in $(basename "$SQL_FILE"): $RESP" >&2; exit 1; }
done

# Fetch the service-role key.
SERVICE_KEY=$(curl -s "${auth[@]}" "$API/projects/$REF/api-keys?reveal=true" \
  | jqpy "d=json.load(sys.stdin);print(next((k['api_key'] for k in d if k.get('name')=='service_role'),''))")
[ -n "$SERVICE_KEY" ] || { echo "!! could not fetch service_role key" >&2; exit 1; }

echo ">> done." >&2
echo "SUPABASE_URL=https://$REF.supabase.co"
echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY"
