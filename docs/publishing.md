# Building sndv-nano

## Prerequisites

```bash
bun install        # install all dependencies
bun run check      # must pass: lint + typecheck + tests
```

## Package dependency order

Packages have a strict dependency order. `config` first, `cli` last.

```
1. config    - no internal deps
2. core      - depends on config
3. memory    - depends on config
4. adapter   - depends on config
5. qmd       - depends on config
6. cli       - depends on all above
```

## Version bump

All packages share the same version. Bump from root:

```bash
VERSION="0.1.1"
for pkg in config core memory adapter qmd cli; do
  cd packages/$pkg
  npm version $VERSION --no-git-tag-version
  cd ../..
done
git add -A && git commit -m "v$VERSION"
git tag "v$VERSION"
```

## Build

```bash
# Clean build (removes all dist/ and .tsbuildinfo)
bun run build:clean

# Incremental build
bun run build

# Full validation
bun run prepublish:all   # clean build + lint + typecheck + test
```

TypeScript compiles each package via `tsc -b` (composite project references). Output goes to `packages/*/dist/`. Source `.ts` stays in `packages/*/src/`.

## Local validation

```bash
bun run check            # lint + typecheck + test
bun run secrets          # scan entire repo for leaked secrets
bun run test:coverage    # tests with coverage report
```

## Link globally

```bash
bun link                              # registers the workspace
cd packages/cli && bun link           # exposes the `sndv` binary
sndv --help                           # now works globally
```

After linking, the `sndv` command works from any directory on your machine.
