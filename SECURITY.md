# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.x.x   | ✅ Yes    |
| 1.x.x   | ❌ No     |

## Reporting a Vulnerability

If you discover a security vulnerability in Transloom, please **do not** open a public GitHub issue.

Instead, report it privately:

**Email:** devahmad41@gmail.com

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will respond within **48 hours** and aim to release a fix within **7 days** of confirmation.

## Security Considerations

- Transloom runs locally on your machine — your source code is never uploaded
- Only extracted string values are sent to the Transloom backend for translation
- API keys are stored in `.transloom.json` — add this to `.gitignore` if your key is sensitive
- All communication with the backend is over HTTPS
