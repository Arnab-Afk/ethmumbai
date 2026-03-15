# Builder image used by the deploy pipeline to clone + build user repos.
# Build this once and push to your registry:
#   docker build -f Dockerfile.builder -t your-registry/everdeploy-builder:node22 .
#   docker push your-registry/everdeploy-builder:node22
#
# Then set DOCKER_IMAGE=your-registry/everdeploy-builder:node22 in your .env

FROM node:22-alpine

# Pre-install git, openssh, and corepack so the deploy pipeline
# never needs to run `apk add` at deploy time (saves ~15-30s per deploy).
RUN apk add --no-cache git openssh-client && \
    corepack enable && \
    corepack prepare pnpm@10.10.0 --activate && \
    corepack prepare yarn@1.22.22 --activate && \
    # Smoke test
    git --version && node --version && npm --version && pnpm --version

# Pre-warm the npm/pnpm global cache dirs so volume mounts land cleanly
RUN mkdir -p /cache/npm /cache/yarn /cache/pnpm-store /cache/pnpm-home /cache/corepack
ENV NPM_CONFIG_CACHE=/cache/npm \
    YARN_CACHE_FOLDER=/cache/yarn \
    PNPM_HOME=/cache/pnpm-home \
    PNPM_STORE_DIR=/cache/pnpm-store \
    COREPACK_HOME=/cache/corepack \
    NEXT_TELEMETRY_DISABLED=1 \
    CI=1
