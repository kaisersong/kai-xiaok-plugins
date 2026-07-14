#!/usr/bin/env bash
# vendor.sh — 从源 repo 同步渲染引擎到 plugin 目录
# 用法:
#   ./scripts/vendor.sh slide-creator    # 同步 slide-creator 渲染引擎
#   ./scripts/vendor.sh report-creator   # 同步 report-creator 渲染引擎
#   ./scripts/vendor.sh all              # 同步全部
#
# 源 repo 路径默认:
#   slide-creator  → ~/projects/slide-creator
#   report-creator → ~/projects/report-creator
# 可通过环境变量覆盖:
#   SLIDE_CREATOR_REPO=/path/to/slide-creator
#   REPORT_CREATOR_REPO=/path/to/report-creator

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SLIDE_CREATOR_REPO="${SLIDE_CREATOR_REPO:-$HOME/projects/slide-creator}"
REPORT_CREATOR_REPO="${REPORT_CREATOR_REPO:-$HOME/projects/report-creator}"

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[vendor]${NC} $*"; }
warn()  { echo -e "${YELLOW}[vendor]${NC} $*"; }
error() { echo -e "${RED}[vendor]${NC} $*" >&2; exit 1; }

vendor_slide_creator() {
    local src="$SLIDE_CREATOR_REPO"
    local dst="$PROJECT_ROOT/plugins/kai-slide-creator"

    if [[ ! -d "$src" ]]; then
        error "slide-creator repo not found: $src"
    fi

    info "Vendoring slide-creator rendering engine from $src"

    # 1. 渲染引擎与保真度 QA 依赖闭包 → mcp-servers/slide-renderer/
    local server_dst="$dst/mcp-servers/slide-renderer"
    local scripts=(
        low_context.py
        validate_html.py
        preset_support.py
        title_profiles.py
        preset_capabilities.py
        preset_profile_renderer.py
        preset_profile_specs.py
        preset_contracts.py
        style_signature_eval.py
        preset_runtime_qa.py
        check_style_fidelity.py
    )
    for script in "${scripts[@]}"; do
        [[ -f "$src/scripts/$script" ]] || error "MISSING required dependency: scripts/$script"
        cp "$src/scripts/$script" "$server_dst/$script"
        info "  scripts/$script → mcp-servers/slide-renderer/$script"
    done

    # 2. 全部 schemas（BRIEF + preset contract/manifest）→ schemas/
    if [[ -d "$src/schemas" ]]; then
        mkdir -p "$dst/schemas"
        rsync -a --delete --exclude '.DS_Store' "$src/schemas/" "$dst/schemas/"
        info "  schemas/ synced"
    else
        error "MISSING required dependency: schemas/"
    fi

    # 3. Preset references, contracts, manifests and native starters → references/
    local ref_dst="$dst/references"
    mkdir -p "$ref_dst"
    rsync -a --delete --exclude '.DS_Store' "$src/references/" "$ref_dst/"
    local ref_count
    ref_count=$(find "$ref_dst" -type f | wc -l | tr -d ' ')
    info "  references/ → $ref_count files"

    # 4. Profile renderers derive their visual shell from canonical demos.
    if [[ -d "$src/demos" ]]; then
        mkdir -p "$dst/demos"
        rsync -a --delete --include '*/' --include '*.html' --exclude '*' "$src/demos/" "$dst/demos/"
        info "  demos/*.html synced"
    else
        error "MISSING required dependency: demos/"
    fi

    # 5. Custom themes → themes/
    if [[ -d "$src/themes" ]]; then
        mkdir -p "$dst/themes"
        rsync -a --exclude '.DS_Store' "$src/themes/" "$dst/themes/"
        local theme_count
        theme_count=$(find "$dst/themes" -type f | wc -l | tr -d ' ')
        info "  themes/ → $theme_count files"
    else
        warn "  MISSING: themes/"
    fi

    # 6. 保留源 repo 的 preset support matrix
    if [[ -s "$ref_dst/preset-support-tiers.json" ]]; then
        info "  references/preset-support-tiers.json copied"
    else
        error "MISSING or empty required dependency: references/preset-support-tiers.json"
    fi

    # 7. Bind plugin CI to the complete, byte-exact dependency closure.
    local source_commit source_dirty vendored_scripts
    source_commit="$(git -C "$src" rev-parse HEAD 2>/dev/null || printf 'unknown')"
    source_dirty=false
    if [[ -n "$(git -C "$src" status --porcelain 2>/dev/null || true)" ]]; then
        source_dirty=true
    fi
    vendored_scripts="$(printf '%s\n' "${scripts[@]}")"
    SOURCE_COMMIT="$source_commit" \
    SOURCE_DIR="$src" \
    SOURCE_DIRTY="$source_dirty" \
    VENDORED_SCRIPTS="$vendored_scripts" \
    VENDOR_DEST="$dst" \
    python3 - <<'PY'
import hashlib
import json
import os
from pathlib import Path

destination = Path(os.environ["VENDOR_DEST"])
paths = {
    Path("mcp-servers/slide-renderer") / name
    for name in os.environ["VENDORED_SCRIPTS"].splitlines()
    if name
}
for root_name in ("schemas", "references", "themes"):
    root = destination / root_name
    if root.is_dir():
        paths.update(path.relative_to(destination) for path in root.rglob("*") if path.is_file())
demos = destination / "demos"
if demos.is_dir():
    paths.update(path.relative_to(destination) for path in demos.rglob("*.html") if path.is_file())

missing = sorted(str(path) for path in paths if not (destination / path).is_file())
if missing:
    raise SystemExit(f"vendored dependency closure is incomplete: {missing}")

files = {
    str(path): hashlib.sha256((destination / path).read_bytes()).hexdigest()
    for path in sorted(paths, key=str)
}
payload = {
    "version": 1,
    "source": "slide-creator",
    "source_commit": os.environ["SOURCE_COMMIT"],
    "source_dirty": os.environ["SOURCE_DIRTY"] == "true",
    "files": files,
}
(destination / "vendor-manifest.json").write_text(
    json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
PY
    info "  vendor-manifest.json → dependency closure hashes"

    info "slide-creator vendor complete"
}

vendor_report_creator() {
    local src="$REPORT_CREATOR_REPO"
    local dst="$PROJECT_ROOT/plugins/kai-report-creator"

    if [[ ! -d "$src" ]]; then
        error "report-creator repo not found: $src"
    fi

    info "Vendoring report-creator rendering engine from $src"

    # report-creator 是 Node.js，同步 src/ 目录
    local server_dst="$dst/mcp-servers/report-renderer"

    if [[ -d "$src/src" ]]; then
        rsync -av --delete "$src/src/" "$server_dst/src/"
        info "  src/ → mcp-servers/report-renderer/src/"
    fi

    if [[ -f "$src/package.json" ]]; then
        cp "$src/package.json" "$server_dst/package.json"
        info "  package.json"
    fi

    if [[ -f "$src/tsconfig.json" ]]; then
        cp "$src/tsconfig.json" "$server_dst/tsconfig.json"
        info "  tsconfig.json"
    fi

    # References / themes
    if [[ -d "$src/references" ]]; then
        rsync -av --delete "$src/references/" "$dst/references/"
        info "  references/ synced"
    fi

    # Schemas
    if [[ -d "$src/schemas" ]]; then
        rsync -av --delete "$src/schemas/" "$dst/schemas/"
        info "  schemas/ synced"
    fi

    # Build MCP server
    if command -v npm &>/dev/null && [[ -f "$server_dst/package.json" ]]; then
        info "  Building MCP server (npm install + build)..."
        (cd "$server_dst" && npm install 2>&1 | tail -1 && npm run build 2>&1 | tail -2)
        info "  Build complete"
    fi

    info "report-creator vendor complete"
}

# 主逻辑
case "${1:-}" in
    slide-creator)
        vendor_slide_creator
        ;;
    report-creator)
        vendor_report_creator
        ;;
    all)
        vendor_slide_creator
        vendor_report_creator
        ;;
    *)
        echo "Usage: $0 {slide-creator|report-creator|all}"
        echo ""
        echo "Sync rendering engines from source repos to plugin directories."
        echo ""
        echo "Environment variables:"
        echo "  SLIDE_CREATOR_REPO   source repo path (default: ~/projects/slide-creator)"
        echo "  REPORT_CREATOR_REPO  source repo path (default: ~/projects/report-creator)"
        exit 1
        ;;
esac
