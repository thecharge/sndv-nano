# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x | Yes |

## Reporting a vulnerability

**Do not open a public issue for security vulnerabilities.**

Email [thecharge@gmail.com](mailto:thecharge@gmail.com) with:

1. Description of the vulnerability
2. Steps to reproduce
3. Impact assessment
4. Suggested fix (if any)

You will receive an acknowledgment within 48 hours and a detailed response within 7 days.

## Security hardening in this project

### Pre-commit

- **Secretlint** scans every commit for leaked API keys, tokens, and credentials
- **Biome** linter catches unsafe code patterns
- **TypeScript strict mode** prevents type-related vulnerabilities

### Runtime

- **No `eval()` or `Function()` constructors** anywhere in the codebase
- **No dynamic `import()` from user input**
- **fetch() only** for LLM calls - no shell exec, no child_process
- **JSONL append-only writes** prevent memory corruption from concurrent access
- **Input validation via Zod schemas** at all system boundaries (CLI args, config, LLM responses)
- **API keys read from environment variables only** - never from config files or CLI args

### Dependencies

- Minimal dependency tree: Zod is the only runtime dependency
- No native addons, no binary dependencies
- Dev dependencies pinned to major versions
- Review `bun.lock` diffs on dependency updates

### LLM integration

- API keys never logged or included in error messages
- Anthropic keys sent via `x-api-key` header (not query params)
- LLM responses validated before use (verdict parsing with fallback)
- No user-controlled data interpolated into system prompts without sanitization

## Disclosure policy

We follow [coordinated disclosure](https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure). After a fix is released, we will credit the reporter (unless they prefer anonymity).
