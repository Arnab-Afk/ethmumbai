# backend-go

A clean Go backend that runs one real pipeline end-to-end:

1. Clone a GitHub repo inside an isolated Docker container.
2. Upload cloned files to IPFS using Pinata Files API.
3. Write the resulting CID to `SubnameRegistry.updateCID(label, cid, meta)` on Sepolia.
4. Stream deployment logs over SSE.

No mocks are used in this service.

## Requirements

- Go 1.23+
- Docker daemon running
- Sepolia RPC URL
- Wallet private key that owns the subname label in `SubnameRegistry`
- Pinata JWT

## Setup

```bash
cd backend-go
cp .env.example .env
# fill the env values
go mod tidy
go run ./cmd/server
```

Server starts on `http://localhost:3002` by default.

## API

All deploy endpoints require a JWT, matching your existing backend pattern:

- Header: `Authorization: Bearer <token>`
- Or query param: `?token=<token>`

If request body omits `githubToken`, the backend automatically uses `githubToken` from JWT claims (GitHub OAuth passthrough).

### `POST /api/v1/deploy`

Body:

```json
{
  "repoUrl": "https://github.com/<owner>/<repo>",
  "label": "myproject",
  "meta": "deploy from backend-go",
  "githubToken": "ghp_xxx_optional_for_private_repo"
}
```

### `POST /api/v1/deploy/stream`

Same request body as `/api/v1/deploy`, but response is `text/event-stream` with events:

- `start`
- `log`
- `heartbeat`
- `error`
- `done`

This matches the streaming style used by your current JS backend.

The service also exposes compatibility aliases so existing frontend code can switch over without path changes:

- `/api/deploy`
- `/api/deploy/stream`
- `/api/deploy/status`
- `/api/auth/me`

### `GET /api/v1/deploy/status`

Returns active deploy count and max concurrency:

```json
{
  "active": 1,
  "max": 3
}
```

### `GET /api/v1/auth/me`

Returns decoded user claims from JWT for frontend session checks.

Supported GitHub URL forms:

- `https://github.com/owner/repo`
- `https://github.com/owner/repo.git`
- `https://github.com/owner/repo/tree/main/subdir`

Success response:

```json
{
  "repoUrl": "https://github.com/owner/repo",
  "label": "myproject",
  "cid": "bafy...",
  "files": 123,
  "txHash": "0x...",
  "blockNumber": 1234567,
  "durationMs": 18000,
  "uploadedPath": "C:\\Users\\...\\backend-go-clone-...\\repo",
  "timestamp": "2026-03-15T10:00:00Z"
}
```

## Isolation details

The clone step runs in a separate Docker container (`alpine/git`) with:

- dropped Linux capabilities (`--cap-drop ALL`)
- no-new-privileges
- CPU, memory, and PID limits
- ephemeral container (`--rm`)

## Notes

- This writes the CID as raw UTF-8 bytes to the contract (same pattern used in current JS backend).
- `label` must already be claimed by the signer wallet, otherwise `updateCID` reverts.
