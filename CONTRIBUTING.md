# Contributing to Transloom

Thank you for your interest in contributing! Here's how to get started.

## Setup

```bash
git clone https://github.com/being-devahmad/transloom-cli
cd transloom-cli
npm install
npm link
```

## Project Structure

```
src/
├── commands/     # CLI commands (init, scan, status, validate, uninstall)
├── core/         # Core logic (extractor, replacer, scanner, writer, namespace)
│   └── setup/    # Framework-specific i18n setup (next-intl, i18next)
├── api/          # Backend API client
└── utils/        # Config and logger helpers
```

## Making Changes

1. Fork the repo
2. Create a branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Test locally with `npm link` in a real React/Next.js project
5. Open a pull request

## Reporting Bugs

Open an issue at [github.com/being-devahmad/transloom-cli/issues](https://github.com/being-devahmad/transloom-cli/issues)

Include:
- Node.js version
- Package version (`transloom --version`)
- Steps to reproduce
- Expected vs actual behavior

## Security Issues

See [SECURITY.md](./SECURITY.md) — do not open public issues for vulnerabilities.
