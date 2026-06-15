#!/usr/bin/env bash
# Generate a strong AUTH_JWT_SECRET.
set -euo pipefail
echo "AUTH_JWT_SECRET=$(openssl rand -base64 48)"
