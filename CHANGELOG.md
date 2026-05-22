# Changelog

All notable changes to Transloom CLI are documented here.

## [2.1.3] - 2026-05-22
### Added
- `repository`, `homepage`, `bugs`, and `keywords` fields to package.json
- MIT license properly declared

## [2.1.2] - 2026-05-22
### Fixed
- README.md renamed to uppercase for proper npm display
- `README.md` explicitly added to `files` field

## [2.1.1] - 2026-05-22
### Fixed
- Framework prompt now skipped if already saved in config
- Duplicate `"en"` in languages array prevented
- Hardcoded `public/locales` path replaced with `config.outputDir`
- File read errors in replacer now caught gracefully
- Poll loop now exits after 5 consecutive server errors with scan ID shown

## [2.1.0] - 2026-05-22
### Added
- `--dry-run` flag for `transloom scan` — preview strings without modifying files
- Replace confirmation prompt — shows preview of all t() replacements before applying
- `transloom validate` command — checks config, API key, framework, and project setup
- Namespace support — group translation keys by feature (`auth.login`, `dashboard.title`)
- Namespace option added to `transloom init`

## [2.0.0] - 2026-05-22
### Added
- `transloom uninstall` command — removes packages, generated files, and config
- Framework-specific i18n setup (next-intl vs i18next) with separate setup files
- `transloom scan` now asks framework, i18n setup, PR creation, and language selector
- `replacer.js` now framework-aware — correct imports for next-intl and i18next
- `transloom validate` config validation
- Backend response validation before writing files

### Changed
- `i18nSetup.js` refactored into parent + `setup/nextIntlSetup.js` + `setup/i18nextSetup.js`
- Framework saved to `.transloom.json` after first scan

### Fixed
- Wrong import paths in replacer (`@/app/lib/i18n` → `next-intl` / `react-i18next`)
- i18next hook syntax fixed (`const { t } = useTranslation()`)

## [1.3.0] - 2026-05-12
### Added
- `transloom status` command
- Usage limit check before scan

## [1.0.0] - 2026-05-12
### Added
- Initial release
- `transloom init` — project setup with API key and language selection
- `transloom scan` — full i18n automation (extract, translate, write, replace)
- AST-based string extraction using tree-sitter
- Support for Next.js and React projects
