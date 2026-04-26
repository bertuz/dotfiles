# Rules

- Write all code, comments, docs, commits, and tests in English, unless the local projects' AGENTS.md file specifies otherwise
- Write self-documenting code, never add explanatory comments
- Use inclusive terms: allowlist/blocklist, primary/replica
- Never use mocks outside test files
- Use `camelCase` for variables 
- Use early returns to avoid nested code

# CLI

Instead of the following traditional commands, use faster alternatives:

- `rg`/`grep` → `ast-grep`
- `find` → `fd`
- `grep` → `rg`
- `tree` for structure
- `jq` and `yq` for data
