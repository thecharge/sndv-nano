# Contributing to sndv-nano

Thank you for contributing to SNDV. This guide explains the workflow, quality bar, and repo standards.

## Prerequisites

- [Bun](https://bun.sh) >= 1.1
- Node.js >= 20 (for version bumps)
- Git

## Setup

```bash
git clone https://github.com/thecharge/sndv-nano.git
cd sndv-nano
bun install
```

Lefthook installs automatically and runs local validation on every commit. We do not rely on hosted CI for correctness; the local checks are the source of truth.

## Code standards

| Rule | Intent |
|---|---|
| Max 300 lines per file | Keep changes reviewable and modular |
| Max 2 nesting levels | Encourage early returns and clarity |
| No `else if` | Use guard clauses |
| No `switch/case` | Use explicit conditionals |
| No `function` declarations | Use `const fn = () => {}` |
| Const arrow functions only | Consistent style |
| Enums from config | No literal unions in app code |
| Errors from factories | `SmepErrors.*` and `CliErrors.*` only |
| No `.js` in imports | TypeScript bundler resolution |

## Branch workflow

1. Fork the repo.
2. Create a feature branch: `git checkout -b feat/my-change`.
3. Make changes. Commit hooks run format, lint, typecheck, tests, spellcheck, and secrets scan.
4. Open a Pull Request against `main`.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(core): add retry backoff to protocol runner
fix(memory): prevent JSONL corruption on concurrent writes
docs: update CLI link instructions
test(adapter): add Claude response parsing tests
chore: bump biome to 2.x
```

## Running checks locally

```bash
bun run lint
bun run lint:fix
bun run typecheck
bun run test
bun run check
bun run secrets
```

## Adding a new package

See [docs/dev-guide.md](docs/dev-guide.md) for the full walkthrough. Short version:

1. `mkdir -p packages/mypkg/src packages/mypkg/test`
2. Add `package.json` with `@thecharge/sndv-mypkg`
3. Add `tsconfig.json` extending root
4. Add path alias + project reference in root `tsconfig.json`
5. `bun install`

## Tests

Every package keeps tests in `test/`. Run a specific package:

```bash
cd packages/core && bun test
```

All tests must pass before merge.

## Security

- Never commit secrets. Secretlint runs on every commit.
- Do not use `eval()` or dynamic code execution.
- Validate at system boundaries (CLI input, file reads, LLM responses).
- Report vulnerabilities privately - see [SECURITY.md](SECURITY.md).

## Pull request checklist

- `bun run check` passes
- No secrets in commits
- All files under 300 lines
- No `else if` or `switch`
- Docs updated if public behavior changed

## License

By contributing you agree to the MIT License.
