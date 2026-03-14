# D3PLOY — Web3 Vercel

> A censorship-resistant deployment platform where sites live on IPFS, resolve through ENS, and cannot be governed by any single entity.

**Reference implementation:** [dhai-eth-site](https://github.com/Dhaiwat10/dhai-eth-site) by Dhaiwat10 — a React + Vite site auto-deployed to IPFS via Pinata and connected to `dhai.eth`.

---

## Table of Contents

1. [Vision & Problem Statement](https://claude.ai/chat/c9d3b907-479d-4b26-8c07-cfc371322bfe#1-vision--problem-statement)
2. [Architecture Overview](https://claude.ai/chat/c9d3b907-479d-4b26-8c07-cfc371322bfe#2-architecture-overview)
3. [Core Stack](https://claude.ai/chat/c9d3b907-479d-4b26-8c07-cfc371322bfe#3-core-stack)
4. [The CLI Tool — `web3deploy`](https://claude.ai/chat/c9d3b907-479d-4b26-8c07-cfc371322bfe#4-the-cli-tool--web3deploy)
5. [ENS as Config Layer](https://claude.ai/chat/c9d3b907-479d-4b26-8c07-cfc371322bfe#5-ens-as-config-layer)
6. [IPFS Storage Strategy](https://claude.ai/chat/c9d3b907-479d-4b26-8c07-cfc371322bfe#6-ipfs-storage-strategy)
7. [CI/CD Pipeline](https://claude.ai/chat/c9d3b907-479d-4b26-8c07-cfc371322bfe#7-cicd-pipeline)
8. [Multi-Sig Governance Deploys](https://claude.ai/chat/c9d3b907-479d-4b26-8c07-cfc371322bfe#8-multi-sig-governance-deploys)
9. [Access Control & Token Gating](https://claude.ai/chat/c9d3b907-479d-4b26-8c07-cfc371322bfe#9-access-control--token-gating)
10. [DeFi-Native Features](https://claude.ai/chat/c9d3b907-479d-4b26-8c07-cfc371322bfe#10-defi-native-features)
11. [Platform Dashboard](https://claude.ai/chat/c9d3b907-479d-4b26-8c07-cfc371322bfe#11-platform-dashboard)
12. [ENS Subname Registry](https://claude.ai/chat/c9d3b907-479d-4b26-8c07-cfc371322bfe#12-ens-subname-registry)
13. [Rollback & Deploy History](https://claude.ai/chat/c9d3b907-479d-4b26-8c07-cfc371322bfe#13-rollback--deploy-history)
14. [Building on dhai-eth-site](https://claude.ai/chat/c9d3b907-479d-4b26-8c07-cfc371322bfe#14-building-on-dhai-eth-site)
15. [Roadmap](https://claude.ai/chat/c9d3b907-479d-4b26-8c07-cfc371322bfe#15-roadmap)
16. [Appendix: ENS Text Record Schema](https://claude.ai/chat/c9d3b907-479d-4b26-8c07-cfc371322bfe#appendix-ens-text-record-schema)

---

## 1. Vision & Problem Statement

### The Problem

Every major web hosting platform — Vercel, Netlify, AWS, Cloudflare — is a centralized choke point. A single legal order, policy change, or infrastructure failure can take down a site in minutes. For DeFi protocols, this is especially dangerous: a compromised or censored frontend has been the attack vector in dozens of exploits and rug pulls.

Traditional hosting also means:

- Domain registrars can seize your `.com`
- CDNs can blacklist your IP
- Build pipelines depend on GitHub, which can suspend accounts
- No on-chain audit trail of what frontend was live when

### The Solution

**D3PLOY** replaces the entire centralized hosting stack with decentralized primitives:

|Traditional|D3PLOY|
|---|---|
|DNS (`A` record → server IP)|ENS `contenthash` → IPFS CID|
|File storage (S3, CDN)|IPFS / Filecoin (content-addressed)|
|Deploy config (env vars, dashboard)|ENS text records (on-chain)|
|Access control (OAuth, JWT)|Token gating (ERC-20/721/1155)|
|Deploy approval (admin button)|Multi-sig wallet (Gnosis Safe)|
|Deploy history (Vercel dashboard)|On-chain smart contract registry|

The result: a site that **no company, government, or individual can take down** — not even the team that built it.

---

## 2. Architecture Overview

```
Developer Machine
      │
      │  git push / web3deploy push
      ▼
┌─────────────────────────────────────────────┐
│              CI/CD Pipeline                 │
│   Build → Upload IPFS → Update ENS → Log   │
└─────────────────────────────────────────────┘
      │                    │
      ▼                    ▼
┌──────────┐        ┌──────────────┐
│   IPFS   │        │  ENS Domain  │
│ Pinata + │◄───────│  contenthash │
│ web3.storage      │  text records│
│ Filebase │        └──────────────┘
└──────────┘               │
      │                    │
      ▼                    ▼
┌─────────────────────────────────────────────┐
│                Access Layer                 │
│  Browser ext │ eth.limo │ Self-hosted node  │
└─────────────────────────────────────────────┘
```

### Data Flow — Single Deploy

1. Developer runs `web3deploy push` or pushes to `main`
2. CLI builds the project (`npm run build` / `vite build` / etc.)
3. Build output (`dist/`) is uploaded to IPFS → returns a CID
4. CID is pinned to 3 providers (Pinata, web3.storage, Filebase)
5. ENS `contenthash` record is updated on-chain to point at the new CID
6. Deploy is logged to the on-chain registry smart contract
7. IPNS record (via w3name) is updated for fast gateway resolution
8. `latest-deploy.json` artifact is written with CID, tx hash, timestamp

---

## 3. Core Stack

### Storage Layer

|Component|Role|Why|
|---|---|---|
|**IPFS**|Immutable file addressing|Content-hash means same file = same address, forever|
|**Filecoin**|Long-term persistence|Economic incentives for pinners to keep data alive|
|**Pinata**|Managed pinning|Reliable API, JWT auth, fast uploads|
|**web3.storage**|Redundant pinning|Decentralized backup, free tier|
|**IPNS / w3name**|Mutable pointer|Stable address that updates with each deploy|

### Naming Layer

|Component|Role|
|---|---|
|**ENS**|Human-readable domain (`myapp.eth`)|
|**ENS contenthash**|Points domain at IPFS CID|
|**ENS text records**|Stores deploy config on-chain|
|**ENS subnames**|Team member identities, environment routing|

### Build Layer

|Component|Role|
|---|---|
|**Vite / Next / Nuxt / SvelteKit**|Framework support|
|**Bun / Node.js**|Runtime|
|**web3deploy CLI**|Build + upload + ENS update in one command|
|**GitHub Actions**|CI/CD automation|

### Governance Layer (Optional)

|Component|Role|
|---|---|
|**Gnosis Safe**|Multi-sig wallet for production deploys|
|**ENS multi-sig record**|Declares required signers on-chain|
|**Deploy registry contract**|Immutable history of all deploys|

---

## 4. The CLI Tool — `web3deploy`

The CLI is the heart of the platform. It abstracts the entire IPFS + ENS update flow into a single command.

### Installation

```bash
npm install -g web3deploy
# or
npx web3deploy init
```

### Commands

#### `web3deploy init`

Initializes a new project. Creates a `web3deploy.config.ts` in the project root and prompts for:

- ENS domain to deploy to
- Build command and output directory
- IPFS pinning providers (Pinata JWT, web3.storage token)
- Private key or wallet connect for ENS updates

```bash
$ web3deploy init

? ENS domain: myapp.eth
? Build command: npm run build
? Output directory: dist
? Pinata JWT: [hidden]
? Also pin to web3.storage? Yes
? Use multi-sig for ENS updates? No (configure later)

✓ Created web3deploy.config.ts
✓ Added .env.example
✓ Updated .gitignore
```

#### `web3deploy push`

Full deploy pipeline:

```bash
$ web3deploy push

Building...       ✓ dist/ (2.3MB, 847 files)
Uploading IPFS... ✓ bafybeig... (Pinata)
Pinning backup... ✓ bafybeig... (web3.storage)
Updating ENS...   ✓ myapp.eth → bafybeig... (tx: 0x3f2a...)
Writing log...    ✓ latest-deploy.json

🚀 Live at https://myapp.eth.limo
   IPFS:  https://bafybeig....ipfs.dweb.link
   ENS:   myapp.eth
```

#### `web3deploy rollback [deploy-id]`

Rolls back to a previous deploy by re-pointing the ENS contenthash:

```bash
$ web3deploy rollback

Recent deploys:
  #12  bafybeig3...  2026-03-13  ← current
  #11  bafybeiab...  2026-03-12
  #10  bafybeif7...  2026-03-11

? Roll back to: #11 (2026-03-12)

Updating ENS... ✓ myapp.eth → bafybeiab... (tx: 0x9c1b...)
✓ Rolled back to deploy #11
```

#### `web3deploy env set [key] [value]`

Stores config in ENS text records:

```bash
$ web3deploy env set deploy.framework next
$ web3deploy env set access.policy public
$ web3deploy env set fee.recipient 0xABCD...
```

#### `web3deploy status`

Shows current deploy state by reading ENS records:

```bash
$ web3deploy status myapp.eth

Domain:      myapp.eth
CID:         bafybeig3...
IPNS:        k51qzi5uqu5...
Framework:   next
Environment: production
Last deploy: 2026-03-13 14:22 UTC
Tx hash:     0x3f2a...
Gateways:
  ✓ https://myapp.eth.limo
  ✓ https://bafybeig3....ipfs.dweb.link
  ✓ https://bafybeig3....ipfs.cf-ipfs.com
```

### Config File — `web3deploy.config.ts`

```typescript
import { defineConfig } from 'web3deploy';

export default defineConfig({
  // ENS domain to deploy to
  domain: 'myapp.eth',

  // Build settings
  build: {
    command: 'npm run build',
    outputDir: 'dist',
    framework: 'vite', // auto-detected if omitted
  },

  // IPFS pinning providers (at least one required)
  pinning: {
    pinata: {
      jwt: process.env.PINATA_JWT,
    },
    web3storage: {
      token: process.env.W3S_TOKEN,
    },
    filebase: {
      key: process.env.FILEBASE_KEY,
      secret: process.env.FILEBASE_SECRET,
    },
  },

  // ENS update signer
  signer: {
    // Option A: private key (non-production)
    privateKey: process.env.DEPLOYER_PRIVATE_KEY,

    // Option B: Gnosis Safe multi-sig (production)
    // safe: {
    //   address: '0xSAFE...',
    //   rpc: 'https://mainnet.infura.io/v3/...',
    //   threshold: 3,
    // },
  },

  // Optional: ENS text records to update on each deploy
  textRecords: {
    'deploy.env': 'production',
    'deploy.framework': 'vite',
  },

  // Optional: IPNS for fast gateway resolution
  ipns: {
    w3nameKey: process.env.W3NAME_KEY_B64,
  },
});
```

---

## 5. ENS as Config Layer

This is the feature that makes D3PLOY genuinely novel. Rather than storing deploy config in a `.env` file, a Vercel dashboard, or a centralized database, **all configuration lives on-chain as ENS text records**.

This means:

- Config is publicly auditable (anyone can verify what your app is configured to do)
- Config is immutable history (you can't silently change it)
- Config is decentralized (no dashboard to hack, no company to subpoena)
- Config is forkable (competitors can inspect and replicate your setup)

### Standard Text Record Schema

Every project deployed via D3PLOY sets these ENS text records:

```
deploy.cid          →  bafybeig3...           (current IPFS CID)
deploy.env          →  production             (environment name)
deploy.framework    →  vite                   (build framework)
deploy.timestamp    →  1741870920             (unix timestamp of last deploy)
deploy.tx           →  0x3f2a...              (ENS update tx hash)
deploy.version      →  1.4.2                  (app semver)
build.command       →  npm run build          (how to reproduce the build)
build.node          →  20                     (Node.js version)
```

### DeFi-Specific Text Records

For DeFi protocols, ENS text records can store user-facing configuration that the frontend and smart contracts can both read:

```
swap.slippage       →  0.5                    (default slippage % for DEX UI)
swap.deadline       →  20                     (tx deadline in minutes)
fee.recipient       →  0xABCD...              (protocol fee address)
fee.bps             →  30                     (fee in basis points)
access.policy       →  token-gated            (public / token-gated / dao)
access.token        →  0xTOKEN...             (required token address)
access.minBalance   →  1                      (minimum token balance required)
```

### Governance Text Records

For DAO-governed protocols:

```
gov.multisig        →  0xSAFE...              (Gnosis Safe address)
gov.threshold       →  3                      (required signatures for deploy)
gov.signers         →  0xA...,0xB...,0xC...   (authorized signer addresses)
gov.proposal        →  https://snapshot.org/# (link to governance proposal)
```

### Environment Routing

ENS subnames can be used for environment routing without any centralized config:

```
myapp.eth           →  contenthash: production CID
staging.myapp.eth   →  contenthash: staging CID
preview.myapp.eth   →  contenthash: preview CID
```

Each subname is independently owned and can be updated without touching the others.

---

## 6. IPFS Storage Strategy

### Content Addressing

IPFS uses content-addressed storage — a file's address is its hash. This means:

- The same file always has the same CID, everywhere on the network
- A changed file has a different CID (you can't silently mutate content)
- CIDs are self-verifying (the content proves its own address)

This is fundamentally different from location-addressed storage (S3, CDN) where the URL is just a pointer that can change or be redirected.

### Pinning Strategy — 3-Provider Redundancy

D3PLOY pins every deploy to three independent providers simultaneously. If any one provider goes down, the other two still serve the content.

```
Deploy Upload
    │
    ├──► Pinata (managed, fast, reliable API)
    ├──► web3.storage (decentralized, free tier)
    └──► Filebase (S3-compatible, Filecoin-backed)
```

Pinning is done in parallel, not sequentially. The deploy is only considered successful when at least 2 of 3 providers confirm the pin.

### IPNS for Stable Addressing

A raw IPFS CID changes with every deploy. IPNS (InterPlanetary Name System) provides a stable, mutable pointer:

```
ipfs://bafybeig3...    ←  changes every deploy
ipns://k51qzi5uqu5...  ←  stable, always points to latest
```

D3PLOY uses `w3name` (as in the reference implementation) to update the IPNS record on each deploy. The ENS `contenthash` record points at the IPNS address, so users always resolve the latest version without a new ENS transaction.

**Why both ENS and IPNS?**

||ENS contenthash|IPNS (w3name)|
|---|---|---|
|Update cost|~$5-20 gas (Ethereum mainnet)|Free (off-chain signing)|
|Resolution|Browser extension / eth.limo|Any IPFS gateway|
|Finality|On-chain, permanent|Revocable|
|Use case|Canonical address|Fast, cheap updates|

For production deploys: update both. For previews and staging: update IPNS only.

---

## 7. CI/CD Pipeline

### GitHub Actions Workflow

Based directly on the `dhai-eth-site` reference implementation, extended for multi-provider pinning:

```yaml
# .github/workflows/deploy.yml
name: Deploy to IPFS + ENS

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  NODE_VERSION: '20'

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Build
        run: bun run build

      - name: Upload to Pinata
        id: pinata
        run: bun run scripts/pin-pinata.ts
        env:
          PINATA_JWT: ${{ secrets.PINATA_JWT }}

      - name: Upload to web3.storage
        id: w3s
        run: bun run scripts/pin-web3storage.ts
        env:
          W3S_TOKEN: ${{ secrets.W3S_TOKEN }}
        continue-on-error: true  # Don't fail deploy if backup fails

      - name: Update IPNS (w3name)
        run: bun run scripts/update-ipns.ts
        env:
          CID: ${{ steps.pinata.outputs.cid }}
          W3NAME_KEY_B64: ${{ secrets.W3NAME_KEY_B64 }}

      - name: Update ENS contenthash
        run: bun run scripts/update-ens.ts
        env:
          CID: ${{ steps.pinata.outputs.cid }}
          ENS_DOMAIN: ${{ vars.ENS_DOMAIN }}
          DEPLOYER_PRIVATE_KEY: ${{ secrets.DEPLOYER_PRIVATE_KEY }}

      - name: Log deploy to registry
        run: bun run scripts/log-deploy.ts
        env:
          CID: ${{ steps.pinata.outputs.cid }}
          REGISTRY_CONTRACT: ${{ vars.REGISTRY_CONTRACT }}
          DEPLOYER_PRIVATE_KEY: ${{ secrets.DEPLOYER_PRIVATE_KEY }}

      - name: Write deploy artifact
        run: |
          echo '{
            "cid": "${{ steps.pinata.outputs.cid }}",
            "domain": "${{ vars.ENS_DOMAIN }}",
            "timestamp": "${{ github.run_id }}",
            "commit": "${{ github.sha }}"
          }' > latest-deploy.json

      - uses: actions/upload-artifact@v4
        with:
          name: deploy-details
          path: latest-deploy.json
```

### Required Secrets / Variables

|Secret|Description|
|---|---|
|`PINATA_JWT`|Pinata API JWT (primary IPFS pinning)|
|`W3S_TOKEN`|web3.storage token (backup pinning)|
|`W3NAME_KEY_B64`|Base64 w3name private key (IPNS updates)|
|`DEPLOYER_PRIVATE_KEY`|EOA private key for ENS transactions|

|Variable|Description|
|---|---|
|`ENS_DOMAIN`|ENS domain to update (e.g. `myapp.eth`)|
|`REGISTRY_CONTRACT`|Deploy registry contract address|

---

## 8. Multi-Sig Governance Deploys

For DeFi protocols, the most important security property is that **a compromised CI/CD pipeline cannot unilaterally push a malicious frontend**. Multi-sig governance deploys solve this.

### How It Works

Instead of a single private key updating the ENS contenthash, the ENS domain is owned by a Gnosis Safe. Any ENS update requires M-of-N signatures from the declared signers.

```
Developer proposes deploy
         │
         ▼
  Gnosis Safe (3-of-5)
         │
    ┌────┴────┐
    │         │
  Sign      Sign      (needs 3 total)
  (Alice)   (Bob)
         │
         ▼
  ENS contenthash updated
  (only after threshold met)
```

### Setup

1. Transfer ENS domain ownership to a Gnosis Safe:

```bash
web3deploy governance setup \
  --domain myapp.eth \
  --safe 0xSAFE... \
  --threshold 3 \
  --signers 0xA...,0xB...,0xC...,0xD...,0xE...
```

2. Store governance config in ENS text records:

```
gov.multisig    → 0xSAFE...
gov.threshold   → 3
gov.signers     → 0xA...,0xB...,0xC...,0xD...,0xE...
```

3. The CI/CD pipeline now proposes the deploy instead of executing it:

```bash
web3deploy push --propose-only
# Creates a Gnosis Safe transaction proposal
# Returns a Safe transaction hash for signers to review
```

4. Signers review and sign via Safe UI or CLI:

```bash
web3deploy governance sign --tx 0xPROPOSAL...
# Signer reviews the CID, then signs
```

5. Once threshold is met, anyone can execute:

```bash
web3deploy governance execute --tx 0xPROPOSAL...
```

### Why This Matters for DeFi

Several major DeFi exploits have happened via compromised frontends — malicious JavaScript injected into a "legitimate" site to drain wallets. Multi-sig deploy governance means:

- No single developer's compromised laptop can push malicious code
- Every frontend update is a reviewable, multi-party decision
- The governance process is transparent and on-chain
- Attackers would need to compromise multiple independent signers simultaneously

---

## 9. Access Control & Token Gating

D3PLOY supports storing access policy in ENS text records, which the frontend reads at runtime to enforce access control.

### Access Modes

```
access.policy  →  public          (anyone can access)
access.policy  →  token-gated     (requires holding a token)
access.policy  →  allowlist       (requires being on an on-chain allowlist)
access.policy  →  dao             (requires a DAO membership NFT)
```

### Token Gating Implementation

When `access.policy = token-gated`, the frontend:

1. Reads `access.token` and `access.minBalance` from ENS text records
2. Prompts the user to connect their wallet
3. Checks the user's balance of the specified token on-chain
4. Renders the app if balance ≥ `access.minBalance`, otherwise shows a paywall

```typescript
// src/hooks/useAccessControl.ts
import { useEnsText } from 'wagmi';
import { useBalance } from 'wagmi';

export function useAccessControl(ensDomain: string) {
  const { data: policy }     = useEnsText({ name: ensDomain, key: 'access.policy' });
  const { data: tokenAddr }  = useEnsText({ name: ensDomain, key: 'access.token' });
  const { data: minBalance } = useEnsText({ name: ensDomain, key: 'access.minBalance' });

  const { data: balance } = useBalance({
    address: userAddress,
    token: tokenAddr as `0x${string}`,
    enabled: policy === 'token-gated' && !!tokenAddr,
  });

  if (policy === 'public') return { hasAccess: true };
  if (policy === 'token-gated') {
    return { hasAccess: balance?.value >= BigInt(minBalance ?? '1') };
  }
  return { hasAccess: false };
}
```

This is powerful because the access policy is **stored on-chain in ENS** rather than on a server. Changing the token required to access the app is an ENS transaction — auditable, reversible, and not dependent on any backend.

---

## 10. DeFi-Native Features

### Swap Preferences in ENS Text Records

A DEX frontend can store default trading parameters in ENS text records. Users can read these directly from the ENS domain to see what defaults the protocol recommends, and the frontend applies them automatically.

```
swap.slippage      → 0.5      (0.5% default slippage)
swap.deadline      → 20       (20-minute tx deadline)
swap.gasMultiplier → 1.2      (20% gas buffer)
swap.defaultToken  → 0xWETH... (default output token)
```

### On-Chain Fee Config

Fee parameters stored in ENS text records are readable by smart contracts directly. This means your frontend and your contracts can reference the same source of truth:

```solidity
// IENSResolver.sol
interface IENSTextResolver {
    function text(bytes32 node, string calldata key) external view returns (string memory);
}

contract MyDEX {
    IENSTextResolver constant ENS = IENSTextResolver(0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63);
    bytes32 constant DOMAIN_NODE = keccak256("myapp.eth");

    function getProtocolFeeBps() public view returns (uint256) {
        string memory feeBps = ENS.text(DOMAIN_NODE, "fee.bps");
        return uint256(keccak256(bytes(feeBps))); // parse string to uint
    }
}
```

### Forkable Protocol Config

Because all config lives on-chain in ENS, competing protocols or community forks can inspect and copy the full config of any protocol. This is a feature, not a bug — it promotes transparency and makes the DeFi ecosystem more legible.

### Named DEX Contracts

Smart contracts themselves can register ENS subnames:

```
router.uniswap.eth     → address: 0xROUTER...
factory.uniswap.eth    → address: 0xFACTORY...
positions.uniswap.eth  → address: 0xNFT...
```

This means users and developers can reference contract addresses by human-readable names instead of raw hex — and the protocol can update contract addresses in ENS without users needing to update bookmarks or references.

---

## 11. Platform Dashboard

The platform dashboard is itself deployed via D3PLOY. It connects to your wallet, reads your ENS domains, and provides a GUI over the CLI functionality.

### Dashboard Features

- **Projects view** — list all ENS domains linked to your wallet, with current CID, last deploy time, and access status
- **Deploy history** — paginated list of all deploys, pulled from the on-chain registry contract
- **Text record editor** — GUI for editing ENS text records (deploy config, DeFi params, access policy)
- **Multi-sig queue** — shows pending deploy proposals awaiting signatures, with diff view of CID changes
- **Gateway health** — polls all IPFS gateways to confirm your CID is reachable
- **Rollback** — one-click rollback to any previous deploy by re-pointing ENS contenthash

### Dashboard Tech Stack

```
Frontend:   React + Vite + Tailwind (deployed via D3PLOY itself)
Wallet:     wagmi + viem + ConnectKit
ENS reads:  @ensdomains/ensjs
ENS writes: wagmi writeContract hooks
IPFS:       @web3-storage/w3up-client
Registry:   ethers.js → custom deploy registry contract
```

---

## 12. ENS Subname Registry

D3PLOY operates a public ENS subname registry so developers without their own ENS domain can deploy immediately.

### Free Tier — `app.d3ploy.eth`

Anyone can claim a subname like `myproject.app.d3ploy.eth` for free. The platform owns `d3ploy.eth` and issues subnames via a smart contract registry.

```bash
web3deploy claim myproject
# Claims myproject.app.d3ploy.eth
# Transfers subname ownership to your wallet
# Updates contenthash to your first deploy
```

### Custom Domain — `myapp.eth`

For production deployments, connect your own ENS domain:

```bash
d3ploy connect myapp.eth
# Verifies you own myapp.eth
# Stores web3deploy config in ENS text records
# Optionally transfers ownership to a Gnosis Safe
```

### Subname Architecture

```
d3ploy.eth              (platform root — owned by team multisig)
  └── app.d3ploy.eth    (free tier subnames — owned by registry contract)
        └── myproject.app.d3ploy.eth  (user subname — owned by user wallet)
```

Each user subname has full ownership — they control the contenthash, text records, and can transfer ownership. The platform cannot censor individual subnames.

---

## 13. Rollback & Deploy History

### On-Chain Deploy Registry

Every deploy is logged to a smart contract:

```solidity
// DeployRegistry.sol
contract DeployRegistry {
    struct Deploy {
        bytes32 cid;        // IPFS CID (bytes32 encoded)
        address deployer;   // wallet that signed the deploy
        uint256 timestamp;  // block timestamp
        string  domain;     // ENS domain
        string  env;        // environment (production, staging)
    }

    mapping(string => Deploy[]) public deployHistory;

    event Deployed(
        string indexed domain,
        bytes32 cid,
        address deployer,
        uint256 timestamp
    );

    function logDeploy(
        string calldata domain,
        bytes32 cid,
        string calldata env
    ) external {
        deployHistory[domain].push(Deploy({
            cid: cid,
            deployer: msg.sender,
            timestamp: block.timestamp,
            domain: domain,
            env: env
        }));
        emit Deployed(domain, cid, msg.sender, block.timestamp);
    }
}
```

This gives an immutable, auditable history of every frontend change — more trustworthy than a Vercel dashboard that can be edited or deleted.

### Rollback Process

Because every previous CID is still pinned on IPFS (content never disappears — only the pointer changes), rollback is simply updating the ENS contenthash to a previous CID:

```bash
web3deploy rollback --to deploy-id-11
# Reads CID from deploy registry contract
# Updates ENS contenthash to that CID
# Logs rollback event to registry
# ✓ Site is now serving the previous version
```

The previous version is already pinned and available on IPFS — no rebuild needed.

---

## 14. Building on dhai-eth-site

The [dhai-eth-site](https://github.com/Dhaiwat10/dhai-eth-site) repo is the cleanest public reference implementation of the core pipeline. Here's how to extend it toward the full platform vision:

### What It Already Has

- React + Vite + TypeScript + Tailwind scaffold
- `scripts/publish-ipfs.ts` — builds, uploads to Pinata, updates w3name IPNS
- `.github/workflows/publish-ipfs.yml` — full CI/CD on push to `main`
- Dockerfile + docker-compose for local IPFS node
- Clean README with step-by-step setup guide

### What to Add

**Step 1 — Generalize the deploy script into a CLI**

Extract `scripts/publish-ipfs.ts` into a standalone package with:

- Config file support (`web3deploy.config.ts`)
- Multiple pinning providers
- ENS contenthash update (the existing script only updates IPNS)
- Deploy logging to registry contract

**Step 2 — Add ENS text record support**

```typescript
// scripts/update-ens-records.ts
import { createPublicClient, createWalletClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { normalize } from 'viem/ens';

async function updateTextRecord(domain: string, key: string, value: string) {
  const walletClient = createWalletClient({ ... });
  
  await walletClient.writeContract({
    address: ENS_PUBLIC_RESOLVER,
    abi: ensResolverAbi,
    functionName: 'setText',
    args: [namehash(normalize(domain)), key, value],
  });
}

// Called after each deploy
await updateTextRecord('myapp.eth', 'deploy.cid', newCid);
await updateTextRecord('myapp.eth', 'deploy.timestamp', Date.now().toString());
```

**Step 3 — Add multi-provider pinning**

```typescript
// scripts/pin-all.ts
import PinataClient from '@pinata/sdk';
import { create as w3sCreate } from '@web3-storage/w3up-client';

async function pinToAll(distPath: string): Promise<string> {
  const [pinataCid, w3sCid] = await Promise.allSettled([
    pinToPinata(distPath),
    pinToW3S(distPath),
  ]);
  
  const primaryCid = pinataCid.status === 'fulfilled'
    ? pinataCid.value
    : w3sCid.status === 'fulfilled' ? w3sCid.value : null;
  
  if (!primaryCid) throw new Error('All pinning providers failed');
  
  return primaryCid;
}
```

**Step 4 — Add deploy registry logging**

```typescript
// scripts/log-deploy.ts
import { createWalletClient } from 'viem';
import { deployRegistryAbi } from '../abi/DeployRegistry';

async function logDeploy(domain: string, cid: string, env: string) {
  const walletClient = createWalletClient({ ... });
  
  await walletClient.writeContract({
    address: REGISTRY_CONTRACT_ADDRESS,
    abi: deployRegistryAbi,
    functionName: 'logDeploy',
    args: [domain, cidToBytes32(cid), env],
  });
}
```

---

## 15. Roadmap

### Phase 1 — MVP CLI (Weeks 1-4)

- [ ] `web3deploy init` — project scaffolding
- [ ] `web3deploy push` — build + Pinata + ENS contenthash update
- [ ] `web3deploy status` — read current ENS records
- [ ] Multi-provider pinning (Pinata + web3.storage)
- [ ] GitHub Actions template

### Phase 2 — Config Layer (Weeks 5-8)

- [ ] ENS text record read/write via CLI
- [ ] `web3deploy.config.ts` file format
- [ ] `web3deploy env set/get` commands
- [ ] Deploy history logged to on-chain registry
- [ ] `web3deploy rollback` command

### Phase 3 — Governance (Weeks 9-12)

- [ ] Gnosis Safe integration for ENS ownership
- [ ] Multi-sig deploy proposals
- [ ] `web3deploy governance setup/sign/execute`
- [ ] ENS text records for governance config

### Phase 4 — Platform (Weeks 13-20)

- [ ] Web dashboard (deployed via D3PLOY)
- [ ] ENS subname registry (`app.d3ploy.eth`)
- [ ] Token gating support
- [ ] DeFi text record schema standardization
- [ ] Public registry of deployed protocols

### Phase 5 — DeFi Integrations (Ongoing)

- [ ] DEX frontend templates with ENS-stored swap config
- [ ] Smart contract ENS text record reader (Solidity library)
- [ ] DAO governance frontend template
- [ ] Cross-protocol ENS config standards (ERC proposal)

---

## Appendix: ENS Text Record Schema

Full reference for all ENS text records used by the platform.

### Deploy Records

|Key|Type|Example|Description|
|---|---|---|---|
|`deploy.cid`|CID string|`bafybeig3...`|Current IPFS CID|
|`deploy.env`|string|`production`|Environment name|
|`deploy.framework`|string|`vite`|Build framework|
|`deploy.timestamp`|unix ts|`1741870920`|Last deploy time|
|`deploy.tx`|tx hash|`0x3f2a...`|ENS update tx hash|
|`deploy.version`|semver|`1.4.2`|App version|
|`build.command`|string|`npm run build`|Build command|
|`build.node`|string|`20`|Node.js version|

### DeFi Records

|Key|Type|Example|Description|
|---|---|---|---|
|`swap.slippage`|float|`0.5`|Default slippage %|
|`swap.deadline`|int|`20`|Tx deadline (minutes)|
|`fee.recipient`|address|`0xABCD...`|Protocol fee recipient|
|`fee.bps`|int|`30`|Fee in basis points|

### Access Control Records

|Key|Type|Example|Description|
|---|---|---|---|
|`access.policy`|enum|`token-gated`|`public`, `token-gated`, `dao`, `allowlist`|
|`access.token`|address|`0xTOKEN...`|Required token contract|
|`access.minBalance`|int|`1`|Minimum token balance|
|`access.chainId`|int|`1`|Chain to check balance on|

### Governance Records

|Key|Type|Example|Description|
|---|---|---|---|
|`gov.multisig`|address|`0xSAFE...`|Gnosis Safe address|
|`gov.threshold`|int|`3`|Required signatures|
|`gov.signers`|csv addresses|`0xA...,0xB...`|Authorized signers|
|`gov.proposal`|URL|`https://snapshot.org/#/...`|Governance proposal link|

---

_Built on top of [dhai-eth-site](https://github.com/Dhaiwat10/dhai-eth-site) — the cleanest reference implementation of IPFS + ENS + GitHub Actions._