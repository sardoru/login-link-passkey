#!/usr/bin/env bash
# List Resend domains and their status. Pick a `verified` domain for AUTH_EMAIL_FROM
# (e.g.  Acme <login@that-domain> ).  Without a verified domain, Resend only
# delivers to the API key owner's own address (onboarding@resend.dev test mode).
#
# Usage:  RESEND_API_KEY=re_xxx ./find-resend-domain.sh
set -euo pipefail
KEY="${RESEND_API_KEY:?set RESEND_API_KEY (re_...)}"
curl -s -H "Authorization: Bearer $KEY" https://api.resend.com/domains \
  | python3 -c "import sys,json
d=json.load(sys.stdin).get('data',[])
if not d: print('(no domains — add + verify one at resend.com/domains)'); raise SystemExit
for x in d: print(f\"{x.get('status'):>12}  {x.get('name')}\")"
