# Render Deployment Setup

## Important: Use Rust Environment, Not Docker

When deploying on Render, make sure to:

1. **Set Environment to `Rust`** (NOT Docker)
   - In Render dashboard: Service Settings → Environment → Select "Rust"
   - Or use the `render.yaml` file which has `env: rust` configured

2. **Root Directory**: `backend`

3. **Build Command**: `cargo build --release`

4. **Start Command**: `./target/release/govtwool-backend`

## Why Not Docker?

The `Dockerfile` is provided for alternative deployment methods (like Railway with Docker), but Render's native Rust environment is:
- Faster to build (no Docker layer overhead)
- Simpler configuration
- Better caching
- Recommended by Render for Rust applications

## If You Must Use Docker

If you need to use Docker on Render (not recommended), ensure:
1. `Cargo.lock` is committed to git (it is now)
2. Set Environment to `Docker` in Render dashboard
3. Root Directory should still be `backend`
4. Render will use the `Dockerfile` automatically

## Environment Variables

Configure the following in the Render dashboard (Settings → Environment):

- **Required**
  - `BLOCKFROST_API_KEY`
- **Recommended**
  - `BLOCKFROST_NETWORK` (`mainnet` or `preview`)
  - `KOIOS_BASE_URL` (defaults to `https://preview.koios.rest/api/v1`)
  - `GOVTOOLS_BASE_URL` (defaults to `https://be.gov.tools`)
  - `GOVTOOLS_ENABLED` (`true`/`false`, defaults to `true`)
  - `CACHE_ENABLED` (`true`/`false`, defaults to `true`)
  - `CACHE_MAX_ENTRIES` (default `10000`)
  - `CORS_ORIGINS` (comma-separated allowlist; defaults to wildcard)

See `backend/README.md` for a full description of each option and their defaults.

## Troubleshooting

### Error: "Cargo.lock not found"

This happens when:
- `Cargo.lock` is not committed to git
- Docker is being used instead of Rust environment

**Solution**: 
1. Make sure `backend/Cargo.lock` is committed: `git add backend/Cargo.lock && git commit`
2. Set Render environment to `Rust` (not Docker)
3. Push changes to trigger a new build

