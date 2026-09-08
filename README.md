# kai-xiaok-plugins

English | [简体中文](README.zh-CN.md)

Bundled skills and MCP tools for the [Xiaok](https://github.com/kaisersong/xiaok-cli) AI workbench: deterministic reports and slides, a local canvas, meeting transcription fallback, and macOS Computer Use. Xiaok CLI and Desktop own model execution, user interaction, permissions, and plugin lifecycle.

## Plugins

Versions below come from the current `plugin.json` manifests, checked on **September 7, 2026**.

| Plugin | Version | Purpose | MCP server / runtime |
|---|---|---|---|
| [kai-slide-creator](plugins/kai-slide-creator) | 3.3.0 | Structured briefs to HTML presentations, with style presets and validation | slide-renderer / Python |
| [kai-report-creator](plugins/kai-report-creator) | 2.3.0 | Structured report IR to HTML, with themes, cover layouts, and KPI quality gates | report-renderer / Node.js |
| [kai-infinity-canvas](plugins/kai-infinity-canvas) | 0.2.0 | Local tldraw canvas, annotation, image insertion, and PNG/SVG export | canvas-server / Node.js |
| [kai-meeting-assistant](plugins/kai-meeting-assistant) | 0.1.0 | Local Whisper file transcription fallback and meeting-summary skill | meeting-transcriber / Python |
| [cua-computer-use](plugins/cua-computer-use) | 0.2.1 | Observe and operate macOS applications after user activation and permission setup | cua-driver / macOS only |

## Current Release Baseline

- The published Xiaok Desktop release is **1.5.1**. Its workflow checks out this repository's **`desktop-v1.5.1`** snapshot; working-tree changes do not update that release.
- Desktop packages all five plugins above. Installation still depends on each plugin's platform, runtime readiness, and activation requirements; Computer Use is unavailable on Windows and Linux.
- Slide/report manifests declare modern MCP stdio with startup/call timeouts. Report uses `dist/server.bundle.js`; Python renderers need the matching packaged runtime and wheels.
- CuaDriver explicitly uses the `legacy` adapter. Meeting transcription retains its MCP 1.x runtime. Protocol selection follows each manifest, not a blanket migration claim.
- Desktop owns microphone capture, Sherpa-ONNX real-time ASR, user-configured Alibaba Cloud/Volcengine ASR, punctuation, model management, recording UI, and saved knowledge. The meeting plugin supplies Whisper fallback and a summary skill; it does not store user ASR keys.
- CLI discovery's legacy `registry.json` still lists report **2.2.0** and canvas **0.1.0**. Current manifests and `registry-v2.json` list **2.3.0** and **0.2.0**. These are distinct index snapshots; check the installation path before treating a listed version as installed.

## Quick Install

### Through Xiaok CLI

```bash
xiaok plugin search
xiaok plugin install kai-slide-creator
xiaok plugin install kai-report-creator
xiaok plugin install kai-meeting-assistant
```

Desktop deploys its bundled plugins and exposes their activation/dependency status in Settings. Computer Use additionally requires macOS permissions and an enabled CUA Driver.

### Through a Prompt

In Xiaok, ask “Install the report creator plugin.” Review the offered installation and dependency actions. Available plugin tools and permission policy determine which actions can run in that session.

### Source Development

```bash
git clone https://github.com/kaisersong/kai-xiaok-plugins.git
cd kai-xiaok-plugins
```

Use the development commands below to build and test an individual plugin. For a Desktop source build, keep this repository alongside `xiaok-cli`, `kswarm`, and `intent-broker`; the packaging configuration reads these sibling directories directly.

## Architecture

```text
Xiaok CLI / Desktop
  ├─ model + selected skill → structured IR
  │    └─ MCP renderer → validation → deterministic HTML + evidence
  ├─ canvas MCP → local canvas / images / exports
  ├─ meeting MCP → local transcription fallback
  └─ macOS Computer Use wrapper → activated CUA Driver

Xiaok attaches inspectable results to conversations, previews,
knowledge, automation runs, or KSwarm project deliverables.
```

### Related Projects

| Project | Responsibility |
|---|---|
| [xiaok-cli](https://github.com/kaisersong/xiaok-cli) | CLI/Desktop, model and tool execution, SubAgents, goals, knowledge, automation, plugin deployment, and previews. |
| [kswarm](https://github.com/kaisersong/kswarm) | Durable projects, workflow execution state, task review, artifact contracts, and delivery. |
| [intent-broker](https://github.com/kaisersong/intent-broker) | Participants, Rooms, events, approvals, and recoverable task handoffs. |

A successful renderer call supplies an artifact; it does not itself approve a project or mark a scheduled run successful. Xiaok and KSwarm apply their completion checks.

## Design Philosophy

For reports and slides, the model prepares structured IR: `BRIEF.json` for slides and `.report.md` for reports. The MCP server validates it, renders HTML/CSS/JS, and checks shell and output contracts.

- **Reproducibility:** fixed IR and renderer versions make output changes inspectable and testable.
- **Concise instructions:** skills describe how to use the tools; schemas, renderers, tests, and evals carry detailed format rules.
- **Programmatic quality checks:** required IDs, export controls, summary metadata, themes, and KPI numbers are verified in code.
- **Separate development evals:** evaluation suites run during development/release validation, not on every user render.

### Report Creator Eval Design

Agent/skill evaluation checks the outcome and how the agent used the skill. Renderer evaluation checks deterministic output from fixed IR: validation, shell, required IDs, KPI quality, components, themes, and performance. See the current [rubric](plugins/kai-report-creator/evals/rubric.json) and [eval cases](plugins/kai-report-creator/evals).

Evaluate real outputs and keep renderer results separate from end-to-end agent/task success. Historical test counts or timings are not a current pass signal.

## Directory Structure

```text
kai-xiaok-plugins/
├── registry.json                 # Legacy CLI discovery index
├── registry-v2.json              # Pinned sources, digests, typed install steps
├── scripts/
│   ├── vendor.sh                 # Copy selected upstream renderer sources
│   └── update-registry-v2.mjs    # Generate from committed Git objects
├── tests/                        # Registry integrity tests
└── plugins/
    ├── kai-slide-creator/        # Skills, schemas, styles, Python renderer
    ├── kai-report-creator/       # Skills, Node renderer, evals
    ├── kai-infinity-canvas/      # Local canvas app and MCP server
    ├── kai-meeting-assistant/    # Meeting skill and Python transcriber
    └── cua-computer-use/         # macOS driver integration
```

## Development

Run each block from this repository's root. Use a Python environment with the appropriate dependencies; source tests do not replace validation of the packaged Python runtime.

### Sync Renderer Sources

Only run vendoring when intentionally updating from an upstream renderer checkout; it copies files into this repository and is not a normal install step.

```bash
./scripts/vendor.sh slide-creator
./scripts/vendor.sh report-creator
```

The Bash script defaults to `~/projects/slide-creator` and `~/projects/report-creator`. Override them with `SLIDE_CREATOR_REPO` and `REPORT_CREATOR_REPO`. Inspect the copied diff before building; Windows development needs a Bash-compatible environment for this script.

### Build and Test

Report renderer:

```bash
npm ci --prefix plugins/kai-report-creator/mcp-servers/report-renderer
npm run build --prefix plugins/kai-report-creator/mcp-servers/report-renderer
npm run build:bundle --prefix plugins/kai-report-creator/mcp-servers/report-renderer
npm test --prefix plugins/kai-report-creator/mcp-servers/report-renderer
npm run eval --prefix plugins/kai-report-creator/mcp-servers/report-renderer
```

Slide renderer and integration tests (replace `python3` with your environment's Python executable as needed):

```bash
python3 -m pip install -r plugins/kai-slide-creator/mcp-servers/slide-renderer/requirements.txt
python3 -m pytest plugins/kai-slide-creator/mcp-servers/slide-renderer/tests -q
python3 -m pytest plugins/kai-slide-creator/tests -q
```

Meeting transcription and registry tests:

```bash
python3 -m pip install -r plugins/kai-meeting-assistant/mcp-servers/meeting-transcriber/requirements.txt
python3 -m pytest plugins/kai-meeting-assistant/tests -q
node --test tests/registry-integrity.test.mjs
```

For runtime or MCP changes, also perform a real stdio initialize smoke test and a representative tool call. Python requirements do not include every development test dependency; install `pytest` in your test environment. Follow the [canvas README](plugins/kai-infinity-canvas/README.md) for its app/server checks.

## Plugin Registry

[registry.json](registry.json) is the legacy discovery index used by `xiaok plugin search`. [registry-v2.json](registry-v2.json) supplies pinned source commits, hashes, and typed install steps for the newer installer. Plugin capabilities, protocol, platforms, and version live in each `plugin.json`.

The v2 generator reads **committed Git objects**, not arbitrary working-tree files. First commit and push the intended source so it is reachable from an `origin` remote ref. With a clean worktree, generate the index:

```bash
node scripts/update-registry-v2.mjs --commit <source-commit>
```

Commit the generated registry to restore a clean worktree, then verify against the original source commit:

```bash
node scripts/update-registry-v2.mjs --commit <source-commit> --check
```

Omitting `--commit` selects HEAD. Keep the chosen source commit explicit when the registry is committed in a later revision. Resolve legacy index/manifest version differences as part of a deliberate plugin release.

## Release Workflow

1. Update the intended plugin sources, manifest version, and relevant index entries; inspect vendored changes.
2. Run its tests/evals, build the report bundle when affected, and verify MCP initialization and representative output.
3. Prepare and validate platform-specific runtime closures and Python wheels. macOS and Windows resources are not interchangeable.
4. Commit and push the source snapshot, generate v2 metadata from it, then commit the registry. Verify against the original source commit and publish the index revision.
5. Align the plugin snapshot with Xiaok's sibling release tags; run Desktop packaging contracts and inspect the unsigned unpacked app before formal release.

Use [Xiaok's release workflow](https://github.com/kaisersong/xiaok-cli/blob/master/.github/workflows/desktop-release.yml) and [packaging configuration](https://github.com/kaisersong/xiaok-cli/blob/master/desktop/electron-builder.json) as the integration contract. Local source, bundles, registry checks, and published release status are separate checks.
