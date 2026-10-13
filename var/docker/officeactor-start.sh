#!/bin/sh

# Start command of OfficeActor's deployment on Render and of its local stack
# (OFFICEACTOR-CHANGES.md -> Deployment on Render). It runs what the image's
# CMD runs, after two adjustments for a platform that configures the container
# from outside.
set -e

cd "$(dirname "$0")/../.."

# Render sets PORT to the port it sends public traffic to, which is nginx
# (5000). The backend reads PORT as well and has to stay on 3000, where nginx
# expects it.
unset PORT

# Render passes another service's host name without a port.
if [ -z "$TEMPORAL_ADDRESS" ] && [ -n "$TEMPORAL_HOST" ]; then
  export TEMPORAL_ADDRESS="$TEMPORAL_HOST:7233"
fi

nginx
exec pnpm run pm2
