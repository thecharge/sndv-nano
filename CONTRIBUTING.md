# Contributing to sndv-nano

Thank you for your interest in contributing. This document covers the rules.

## Prerequisites

- [Bun](https://bun.sh) >= 1.1
- Node.js >= 20 (for version bumps via `npm version`)
- Git

## Setup

```bash
git clone https://github.com/thecharge/sndv-nano.git
cd sndv-nano
bun install
```

Lefthook installs automatically via `bun install`. Pre-commit hooks run format, lint, typecheck, tests, spell check, and secret scanning on every commit.

## Code standards

| Rule | Enforced by |
|---|---|
| **≤ 300 lines per source file** | Code review |
| **Max 2 nesting levels** | Biome cognitive complexity + review |
| **No `else if`** | Use early `return` / `continue` |
| **No `switch/case`** | Use early returns with `if` |
| **No `function` declarations** | Use `const fn = () => {}` |
| **Const arrow functions only** | Biome + review |
| **No `.js` in imports** | TypeScript bundler resolution |
| **Enums from config package** | Review |
| **Errors from factory** | `SmepErrors.protocolEmpty()`, not `new Error(...)` |

## Branch workflow

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-change`
3. Make changes — hooks will validate on commit
4. Push and open a Pull Request against `main`

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(core): add retry backoff to protocol runner
fix(memory): prevent JSONL corruption on concurrent writes
docs: update LLM provider table
test(adapter): add Anthropic response parsing tests
chore: bump biome to 2.5
```

## Running checks locally

```bash
bun run check          # lint + typecheck + test (same as CI)
bun run lint:fix       # auto-fix formatting
bun run test           # all tests
bun run typecheck      # TypeScript strict
bunx secretlint "**/*" # scan for leaked secrets
```

## Adding a new package

See [docs/dev-guide.md](docs/dev-guide.md) for the full walkthrough. Short version:

1. `mkdir -p packages/mypkg/src packages/mypkg/test`
2. Create `package.json` with `@thecharge/sndv-mypkg` name
3. Create `tsconfig.json` extending root, add references
4. Add path alias to root `tsconfig.json`
5. `bun install`

## Tests

Every package has tests in `test/`. Run a specific package:

```bash
cd packages/core && bun test
```

Tests must pass before merge. No exceptions.

## Security

- **Never commit secrets**. Secretlint runs in pre-commit hooks.
- **No `eval()`, `Function()`, or dynamic code execution**.
- **Validate at system boundaries** (CLI input, LLM responses, file reads).
- Report vulnerabilities privately — see [SECURITY.md](SECURITY.md).

## Pull Request checklist

- [ ] `bun run check` passes (lint + typecheck + test)
- [ ] No secrets in committed files
- [ ] All source files ≤ 300 lines
- [ ] No nesting beyond 2 levels
- [ ] No `else if`, no `switch/case`
- [ ] Conventional commit message
- [ ] Updated docs if public API changed

## License

By contributing you agree that your contributions are licensed under the MIT License.
