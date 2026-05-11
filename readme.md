# 🌍 Transloom CLI

> AI-powered i18n automation CLI for React & Next.js

[![npm version](https://img.shields.io/npm/v/transloom.svg)](https://www.npmjs.com/package/transloom)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](https://opensource.org/licenses/MIT)

---

## 📦 Installation

```bash
npx transloom scan
# or
npm install -g transloom
```

---

## 🏗️ Project Structure

```
transloom-cli/
├── src/
│   ├── index.js          # CLI entry point
│   ├── commands/
│   │   ├── init.js       # transloom init
│   │   └── scan.js       # transloom scan
│   ├── core/
│   │   ├── scanner.js    # File discovery
│   │   ├── extractor.js  # tree-sitter extraction
│   │   └── writer.js     # JSON files writer
│   ├── api/
│   │   └── client.js     # Backend API calls
│   └── utils/
│       ├── config.js     # .transloom.json
│       └── logger.js     # Terminal output
├── package.json
└── README.md
```

---

## ⚙️ Tech Stack

| Tool                   | Purpose             |
| ---------------------- | ------------------- |
| Node.js                | Runtime             |
| Commander.js           | CLI framework       |
| tree-sitter            | AST parsing         |
| tree-sitter-javascript | JSX/TSX support     |
| Axios                  | HTTP requests       |
| Chalk                  | Colored output      |
| Ora                    | Loading spinners    |
| Inquirer               | Interactive prompts |
| fs-extra               | File handling       |

---

## 🚀 Commands

```bash
# Initialize in your project
transloom init

# Run full i18n automation
transloom scan

# Check scan history + usage
transloom status
```

---

## 🔄 Scan Flow

```
1. File Discovery
   → Find all .jsx .tsx .js .ts files
   → Ignore node_modules, dist, .next

2. String Extraction (tree-sitter)
   → JSX text nodes
   → String attributes (placeholder, title, alt)
   → String literals

3. Send to Backend
   → POST /api/scans/start/
   → Backend handles AI (Claude API)

4. Poll for Results
   → GET /api/scans/{id}/results/
   → Every 3 seconds

5. Write Locale Files
   → public/locales/en.json
   → public/locales/de.json

6. GitHub PR
   → Backend opens PR automatically
```

---

## ⚙️ Config File

`.transloom.json` in project root:

```json
{
  "apiKey": "tl_xxxxxxxxxxxx",
  "languages": ["en", "de"],
  "framework": "nextjs",
  "outputDir": "public/locales",
  "ignore": ["node_modules", "dist", ".next", "build"]
}
```

---

## 🔒 Security

- ✅ Source code never leaves your machine
- ✅ Only extracted strings sent to server
- ✅ API key authentication
- ✅ HTTPS encrypted

---

## 🛠️ Local Development

```bash
# Clone repo
git clone https://github.com/being-devahmad/transloom-cli
cd transloom-cli

# Install dependencies
npm install

# Test locally
node src/index.js init
node src/index.js scan
```

---

## 📦 Publishing

```bash
# Update version
npm version patch

# Publish to npm
npm publish
```

---

## 🔗 Related

- 🌐 Website: [transloom.com](https://localeflow.vercel.app)
- ⚙️ Backend: [transloom-backend](https://github.com/being-devahmad/transloom-backend)
- 📦 npm: [npmjs.com/package/transloom](https://npmjs.com/package/transloom)

---

<p align="center">Built for developers, by developers 💜</p>
