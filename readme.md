# 🌍 Transloom CLI

> Automatically find every hardcoded string in your React / Next.js project, translate it into multiple languages using AI, and wire up i18n — without touching a single file manually.

[![npm version](https://img.shields.io/npm/v/transloom.svg)](https://www.npmjs.com/package/transloom)
[![Node >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](https://opensource.org/licenses/MIT)

---

## What does it do?

You have a React or Next.js app full of hardcoded English strings like this:

```jsx
<h1>Welcome back</h1>
<button>Sign in</button>
<input placeholder="Enter your email" />
```

Run one command and Transloom:

1. **Finds** every hardcoded string across your entire codebase
2. **Translates** them into your chosen languages using AI
3. **Writes** locale JSON files (`en.json`, `de.json`, `fr.json` …)
4. **Replaces** hardcoded strings with `t()` calls in your source files
5. **Sets up** the i18n library (next-intl or i18next) for you

Your code becomes:

```jsx
<h1>{t('welcome_back')}</h1>
<button>{t('sign_in')}</button>
<input placeholder={t('enter_email')} />
```

---

## Quick Start

```bash
# Step 1 — install globally
npm install -g transloom

# Step 2 — go to your project
cd my-react-app

# Step 3 — initialize (one time)
transloom init

# Step 4 — run automation
transloom scan
```

That's it. Your app is now i18n-ready.

---

## Installation

```bash
# Global (recommended)
npm install -g transloom

# Or run without installing
npx transloom init
```

**Requirements:** Node.js 18 or higher

---

## Commands

### `transloom init`

Run this once inside your project before anything else.

```bash
transloom init
```

It will ask you:

- Your Transloom API key (`tl_xxxx…`)
- Target languages (German, French, Spanish, Urdu, Chinese…)
- Output directory for locale files (default: `public/locales`)
- Whether to enable namespace support (groups keys by feature)

Creates a `.transloom.json` config file in your project root.

---

### `transloom scan`

The main command. Scans your project, translates strings, and sets everything up.

```bash
transloom scan
```

During the scan it interactively asks:

| Prompt                       | What it does                                              |
| ---------------------------- | --------------------------------------------------------- |
| Which framework?             | Next.js or React — installs the right package             |
| Set up i18n?                 | Install next-intl / i18next and create config files       |
| Create GitHub PR?            | Backend opens a PR with all the changes                   |
| Language selector component? | Already have one / Create for me / I'll do it later       |
| Replace strings in source?   | Shows a preview of all replacements, then asks to confirm |

#### Dry run mode

Want to see what strings would be extracted **without changing any files**?

```bash
transloom scan --dry-run
```

Shows a table of every string found (file, line number, text) and exits — nothing is written or replaced.

---

### `transloom validate`

Check that everything is correctly set up before running a scan.

```bash
transloom validate
```

Checks:

- `.transloom.json` exists
- API key format and authentication
- Your scan usage / limit
- Framework configuration
- Languages list
- Output directory
- `package.json` present
- i18n package installed (next-intl or i18next)

Example output:

```
  ✔ .transloom.json found
  ✔ API key authenticated as john_doe
  ✔ Usage: 3/10 scans
  ✔ Framework: nextjs
  ✔ Languages: en, de, fr
  ✔ Output dir: public/locales
  ✔ next-intl installed (^3.0.0)

  ✅ All checks passed (7/7)
```

---

### `transloom status`

Shows your account info, usage stats, and current project config.

```bash
transloom status
```

---

### `transloom uninstall`

Removes everything Transloom added to your project.

```bash
transloom uninstall
```

Removes:

- Installed i18n packages (`next-intl` or `i18next react-i18next`)
- Generated files (`i18n/request.ts`, `middleware.ts`, `LanguageSelector.tsx` etc.)
- Translation locale files (`public/locales/`)
- `.transloom.json` config

---

## What gets generated

### Next.js (next-intl)

```
your-project/
├── i18n/
│   └── request.ts          ← locale configuration
├── middleware.ts            ← routing middleware
├── public/locales/
│   ├── en.json
│   ├── de.json
│   └── fr.json
└── app/components/
    └── LanguageSelector.tsx ← ready-to-use switcher (if requested)
```

### React (i18next)

```
your-project/
├── src/
│   ├── i18n.ts             ← i18next configuration
│   ├── I18nProvider.tsx    ← wrap your app with this
│   └── components/
│       └── LanguageSelector.tsx
└── public/locales/
    ├── en.json
    └── de.json
```

---

## Config File

`.transloom.json` is created by `transloom init` and lives in your project root.

```json
{
  "apiKey": "tl_xxxxxxxxxxxx",
  "languages": ["en", "de", "fr"],
  "framework": "nextjs",
  "outputDir": "public/locales",
  "namespace": false,
  "ignore": ["node_modules", "dist", ".next", "build", "coverage", ".git"]
}
```

| Field       | Description                                                    |
| ----------- | -------------------------------------------------------------- |
| `apiKey`    | Your Transloom API key                                         |
| `languages` | Languages to translate into — `en` is always the base          |
| `framework` | `"nextjs"` or `"react"`                                        |
| `outputDir` | Where locale JSON files are written                            |
| `namespace` | Group keys by feature (`auth.login`) instead of flat (`login`) |
| `ignore`    | Folders to skip during file discovery                          |

---

## Namespace Support

When `namespace: true`, keys are grouped by the feature/folder they come from instead of being flat.

**Without namespace (default):**

```json
{
  "login": "Login",
  "signup": "Sign Up",
  "dashboard_title": "Dashboard",
  "profile_name": "Your Name"
}
```

**With namespace:**

```json
{
  "auth": {
    "login": "Login",
    "signup": "Sign Up"
  },
  "dashboard": {
    "title": "Dashboard"
  },
  "profile": {
    "name": "Your Name"
  }
}
```

Code becomes:

```jsx
t("auth.login"); // instead of t('login')
t("dashboard.title"); // instead of t('dashboard_title')
```

Namespaces are derived automatically from the file path:

- `src/app/auth/page.tsx` → `auth`
- `src/app/dashboard/page.tsx` → `dashboard`
- `src/components/Navbar.tsx` → `navbar`

Enable it during `transloom init` or add `"namespace": true` to `.transloom.json` manually.

---

## How the scan works (full flow)

```
transloom scan
     │
     ├─ 1. Validate API key + check scan limit
     ├─ 2. Ask: framework (Next.js / React)
     ├─ 3. Discover all .js .jsx .ts .tsx files
     ├─ 4. Ask: set up i18n? (Yes / No)
     ├─ 5. Ask: create GitHub PR? (Yes / No)
     ├─ 6. Extract hardcoded strings using AST parser (tree-sitter)
     ├─ 7. Send strings to Transloom backend
     ├─ 8. AI translates into all selected languages
     ├─ 9. Preview replacements → ask confirmation
     ├─ 10. Write locale JSON files
     ├─ 11. Replace hardcoded strings with t() calls in source
     └─ 12. Install i18n package + create setup files
```

### What the extractor catches

| Type              | Example                     |
| ----------------- | --------------------------- |
| JSX text          | `<button>Sign in</button>`  |
| Attributes        | `placeholder="Enter email"` |
| Toast/alert calls | `toast.success("Saved!")`   |

### What it skips

- URLs, hex colors, class names
- Numbers and operators
- camelCase identifiers
- Single-character strings
- Code fragments

---

## Security

- ✅ Your source code **never** leaves your machine
- ✅ Only the extracted text strings are sent to the server
- ✅ API key authenticated on every request
- ✅ All communication over HTTPS

---

## Related

- 🌐 Dashboard: [localeflow.vercel.app](https://localeflow.vercel.app)
- ⚙️ Backend: [github.com/being-devahmad/transloom-backend](https://github.com/being-devahmad/transloom-backend)
- 📦 npm: [npmjs.com/package/transloom](https://npmjs.com/package/transloom)

---

<p align="center">Built for developers, by Ahmad Owais</p>
