"""Record the upstream reference/theme closure for the report adapter."""
import hashlib
import json
import os
import subprocess
from pathlib import Path

source = Path(os.environ["SOURCE_DIR"])
destination = Path(os.environ["VENDOR_DEST"])
commit = subprocess.check_output(["git", "-C", str(source), "rev-parse", "HEAD"], text=True).strip()
files = {}
for folder in ("references", "themes"):
    for path in sorted((source / folder).rglob("*")):
        if path.is_file() and path.name != ".DS_Store":
            relative = path.relative_to(source)
            target = destination / relative
            if target.read_bytes() != path.read_bytes():
                raise SystemExit(f"Upstream drift: {relative}")
            files[str(relative)] = hashlib.sha256(target.read_bytes()).hexdigest()
version = next(line.split(":", 1)[1].strip() for line in (source / "SKILL.md").read_text().splitlines() if line.startswith("version:"))
(destination / "vendor-manifest.json").write_text(json.dumps({
    "version": 1, "source": "report-creator", "source_commit": commit,
    "source_version": version,
    "source_dirty": bool(subprocess.check_output(["git", "-C", str(source), "status", "--porcelain"], text=True)),
    "adapter": "plugin-owned TypeScript renderer; upstream templates do not overwrite adapter CSS",
    "files": files,
}, ensure_ascii=False, indent=2) + "\n")
