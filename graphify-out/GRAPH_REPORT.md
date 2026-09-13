# Graph Report - NoConnectionNeeded  (2026-09-12)

## Corpus Check
- Corpus is ~36,728 words - fits in a single context window. You may not need a graph.

## Summary
- 305 nodes · 523 edges · 25 communities (15 shown, 4 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 1% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.82)
- Token cost: 437,039 input · 26,099 output

## Community Hubs (Navigation)
- React UI Shell & Light-Theme Redesign
- Go WASM Runtime Bridge (wasm_exec)
- Go Core: Merkle & Pollar Engine
- npm Manifest & Scripts
- Stellar Crypto & Testnet Integration
- Pollar Engine Hashing & Stellar Bugfix
- Go Crypto Primitives & WASM Wrappers
- App Entry, PWA Shell & Starter Assets
- Runtime Dependencies
- Soroban Offline Vault Contract
- Dev Dependencies & Build Tooling
- Android Test Scaffolding
- PWA Manifest Fields
- Oxlint Lint Rules
- Gradle Wrapper Script
- Android Capacitor Bridge
- Service Worker Cache
- pollar-core WASM Module
- pollar-offline-vault Contract

## God Nodes (most connected - your core abstractions)
1. `useWallet()` - 23 edges
2. `react` - 16 edges
3. `WalletProvider()` - 14 edges
4. `lucide-react` - 13 edges
5. `PollarEngineService` - 11 edges
6. `DualSignedTransaction` - 10 edges
7. `Rediseño UI - Tema Claro Wallet Style (2026-09-12)` - 10 edges
8. `OfflineVault` - 9 edges
9. `sha256Hex()` - 9 edges
10. `NewMerkleTree()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `sw.js Service Worker Registration` --semantically_similar_to--> `sha256Pure Pure-JavaScript SHA-256 Fallback`  [INFERRED] [semantically similar]
  index.html → .mds/BUGFIX-2026-09-12-stellar-errors.md
- `Pollar - Offline Stellar P2P Wallet` --conceptually_related_to--> `buildRealMerkleTree`  [INFERRED]
  index.html → .mds/BUGFIX-2026-09-12-stellar-errors.md
- `GenerateNewKeyPairJSON()` --calls--> `GenerateKeyPair()`  [INFERRED]
  core-go/pkg/pollarcore/pollarcore.go → core-go/pkg/pollarcore/crypto.go
- `src/main.jsx entry module` --conceptually_related_to--> `React + Vite Template`  [INFERRED]
  index.html → README.md
- `TestPollarCoreFlow()` --calls--> `GenerateKeyPair()`  [INFERRED]
  core-go/pkg/pollarcore/pollarcore_test.go → core-go/pkg/pollarcore/crypto.go

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Pure-JS SHA-256 Fallback Crypto Flow** — _mds_bugfix_2026_09_12_stellar_errors_sha256pure, _mds_bugfix_2026_09_12_stellar_errors_sha256hex, src_services_stellarcrypto, src_services_pollarengine, _mds_bugfix_2026_09_12_stellar_errors_cryptosubtle_secure_context [EXTRACTED 1.00]
- **Light Theme Wallet-Style Redesign Across Components** — src_components_authgateway, src_app, src_components_walletvault, src_components_p2ppaymentterminal, src_components_syncmanager, src_components_floatingdemohelper [INFERRED 0.85]
- **Offline PWA Bootstrap Stack (Go WASM + Service Worker)** — index, index_wasm_exec, index_service_worker, index_main_jsx, index_manifest [INFERRED 0.85]
- **Stock Vite React starter asset bundle (template leftovers)** — src_assets_hero [INFERRED 0.85]
- **pollar_icon_brand_identity_lockup** — src_assets_pollar, src_assets_pollar_glyph, src_assets_pollar_brand_mark [INFERRED 0.75]

## Communities (25 total, 4 thin omitted)

### Community 0 - "React UI Shell & Light-Theme Redesign"
Cohesion: 0.14
Nodes (26): onClick SyntheticEvent Binding Bug, Rediseño UI - Tema Claro Wallet Style (2026-09-12), src/styles/index.css, Light Theme Color Palette, Tailwind v4 Arbitrary-Value Hex Fix, buffer, canvas-confetti, lucide-react (+18 more)

### Community 1 - "Go WASM Runtime Bridge (wasm_exec)"
Cohesion: 0.06
Nodes (6): constructor(), _makeFuncWrapper(), _resume(), run(), write(), writeSync()

### Community 2 - "Go Core: Merkle & Pollar Engine"
Cohesion: 0.10
Nodes (22): buildTreeLevel(), ComputeLeafHash(), HashPair(), NewMerkleTree(), VerifyProof(), GenerateNewKeyPairJSON(), NewPollarEngine(), SignAndPackageTransaction() (+14 more)

### Community 3 - "npm Manifest & Scripts"
Cohesion: 0.08
Nodes (24): name, private, scripts, build, dev, lint, preview, type (+16 more)

### Community 4 - "Stellar Crypto & Testnet Integration"
Cohesion: 0.17
Nodes (22): @stellar/stellar-sdk, WalletProvider(), buildRealMerkleTree(), bytesToHex(), computeCanonicalTxHash(), computeMerkleLeafHash(), counterSignPaymentReceipt(), fetchRealAccountBalances() (+14 more)

### Community 5 - "Pollar Engine Hashing & Stellar Bugfix"
Cohesion: 0.15
Nodes (12): Bugfix: Stellar Testnet Payment Errors (2026-09-12), buildRealMerkleTree, crypto.subtle Secure-Context Requirement, sha256Hex, sha256Pure Pure-JavaScript SHA-256 Fallback, buf2hex(), hashPair(), pollarEngine (+4 more)

### Community 6 - "Go Crypto Primitives & WASM Wrappers"
Cohesion: 0.20
Nodes (15): ComputeTxHash(), CounterSignReceipt(), GenerateKeyPair(), SignTransactionPayload(), VerifyDualSignedTransaction(), VerifySignature(), buildMerkleTreeWrapper(), computeTxHashWrapper() (+7 more)

### Community 7 - "App Entry, PWA Shell & Starter Assets"
Cohesion: 0.15
Nodes (16): src/main.jsx entry module, manifest.json web app manifest, Pollar - Offline Stellar P2P Wallet, sw.js Service Worker Registration, wasm_exec.js (Go WebAssembly runtime), README (React + Vite template), Oxlint, React Compiler (+8 more)

### Community 8 - "Runtime Dependencies"
Cohesion: 0.17
Nodes (12): dependencies, buffer, canvas-confetti, @capacitor/core, clsx, html5-qrcode, lucide-react, qrcode (+4 more)

### Community 9 - "Soroban Offline Vault Contract"
Cohesion: 0.29
Nodes (7): Address, BytesN, PollarOfflineVaultContract, VAULT, VaultState, Env, Symbol

### Community 10 - "Dev Dependencies & Build Tooling"
Cohesion: 0.20
Nodes (10): devDependencies, @capacitor/android, @capacitor/cli, oxlint, tailwindcss, @tailwindcss/vite, @types/react, @types/react-dom (+2 more)

### Community 11 - "Android Test Scaffolding"
Cohesion: 0.33
Nodes (5): ExampleInstrumentedTest, ExampleUnitTest, androidx.test.ext.junit.runners.AndroidJUnit4, org.junit.runner.RunWith, org.junit.Test

### Community 12 - "PWA Manifest Fields"
Cohesion: 0.22
Nodes (8): background_color, display, icons, name, orientation, short_name, start_url, theme_color

### Community 13 - "Oxlint Lint Rules"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 14 - "Gradle Wrapper Script"
Cohesion: 0.83
Nodes (3): gradlew script, die(), warn()

## Ambiguous Edges - Review These
- `P2PPaymentTerminal.jsx` → `pollarEngine.js`  [AMBIGUOUS]
  .mds/REDESIGN-2026-09-12-light-theme.md · relation: conceptually_related_to
- `index.html` → `hero.png — Vite React Starter Hero Graphic (343x361 indexed PNG, unused in Pollar)`  [AMBIGUOUS]
  src/assets/hero.png · relation: conceptually_related_to
- `Pollar Product Brand Mark` → `Possible Stylized 'P' Letterform`  [AMBIGUOUS]
  src/assets/pollar.webp · relation: conceptually_related_to

## Knowledge Gaps
- **60 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `pollar-offline-vault` (+55 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 117 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `P2PPaymentTerminal.jsx` and `pollarEngine.js`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `index.html` and `hero.png — Vite React Starter Hero Graphic (343x361 indexed PNG, unused in Pollar)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Pollar Product Brand Mark` and `Possible Stylized 'P' Letterform`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `react` connect `React UI Shell & Light-Theme Redesign` to `npm Manifest & Scripts`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `sha256Pure Pure-JavaScript SHA-256 Fallback` connect `Pollar Engine Hashing & Stellar Bugfix` to `Stellar Crypto & Testnet Integration`, `App Entry, PWA Shell & Starter Assets`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Runtime Dependencies` to `npm Manifest & Scripts`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `$schema`, `plugins`, `react/rules-of-hooks` to the rest of the system?**
  _60 weakly-connected nodes found - possible documentation gaps or missing edges._