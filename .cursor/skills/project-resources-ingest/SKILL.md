---
name: project-resources-ingest
description: >-
  Downloads HTTP/HTTPS assets into the project root res/ tree with organized
  subfolders and filenames, and copies arbitrary local files into the same res/
  tree as project-owned duplicates. Use when the user asks to download web
  resources, vendor external files, mirror URLs locally, ingest assets, or copy
  files from another disk path into the repository under res/.
---

# Project resources ingest (res/)

## Goal

Place **every** ingested asset under **`res/`** at the **task root** (the root directory explicitly stated in the requirement; if none is stated, default to workspace root). The agent chooses **`res/<subfolder>/`** and **filenames** for clarity, stability, and low collision risk.

## Layout conventions

- **`res/`** may contain any depth: e.g. `res/images/`, `res/fonts/vendor-name/`, `res/audio/sfx/`, `res/data/vendor/`.
- **Subfolder choice**: group by purpose and origin (type first, then domain/vendor if useful).
  - Examples: `res/images/icons/`, `res/vendor/jquery/`, `res/local/refs/`.
- **Filename choice**:
  - Prefer the last path segment of the URL or the source basename; normalize to safe ASCII where reasonable.
  - If a name would collide, append `-2`, `-v2`, or a short hash suffix before the extension.
- **Do not** silently overwrite an existing file; if unsure, use a new name or ask.

## Remote URLs (download)

1. Resolve **project root** and ensure **`res/`** exists.
2. Pick **`res/<subfolder>/`** and **`target filename`** per conventions above.
3. Download with a reliable tool (examples):
   - **curl**: `curl -L "<url>" -o "res/sub/file.ext"`
   - **PowerShell**: `Invoke-WebRequest -Uri "<url>" -OutFile "res/sub/file.ext" -UseBasicParsing`
4. Confirm the file exists and non‑zero size; on failure, retry or report the error.
5. If the task updates code that references the asset, switch references to **project‑relative paths** (e.g. `res/...`).

## Local paths (copy into project)

1. Resolve **project root** and ensure **`res/`** exists.
2. Pick **`res/<subfolder>/`** (e.g. `res/local/screenshots/`, `res/references/`) and **`target filename`** (may keep original basename).
3. Copy (examples):
   - **PowerShell**: `Copy-Item -Path "D:/path/source.ext" -Destination "res/sub/target.ext"`
   - **cp** (Unix shell): `cp "/path/source.ext" "res/sub/target.ext"`
4. Confirm the copy; treat permissions and missing paths explicitly.

## Documentation and project rules

- If the ingest is part of a larger deliverable, follow **`execution-logging`** (log under root `log/`) and **`product-artifacts`** / **`code-artifacts`** when the user also asks for product bundles or reproducible scripts.
- Optionally note in **`plan/plan.md`** when ingestion is a planned step (per **`plan-archiving-and-status`**).

## Quick checklist

- [ ] All assets land under **root `res/`**
- [ ] Subfolders and names are intentional and collision‑safe
- [ ] Download/copy verified on disk
- [ ] Code references updated when the user expects the app to use the new paths

For more naming examples, see [examples.md](examples.md).
