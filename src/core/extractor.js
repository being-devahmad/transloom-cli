import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import path from "path";
import fs from "fs-extra";

// Single parser instance — reused across files
const parser = new Parser();

// Patterns to skip — not translatable strings
const SKIP_PATTERNS = [
  /^https?:\/\//,           // URLs
  /^#[0-9a-fA-F]{3,8}$/,   // Hex colors
  /^\s*$/,                   // Whitespace only
  /^[0-9\s.,!?-]+$/,        // Numbers/punctuation only
  /^[a-z][a-zA-Z0-9]*$/,   // camelCase identifiers
  /\.(js|ts|jsx|tsx|css|png|jpg|svg)$/, // File extensions
  /^\/[a-zA-Z]/,            // Paths starting with /
];

const SKIP_CALL_NAMES = new Set([
  "console", "require", "import", "typeof", "instanceof",
  "className", "classNames", "clsx", "cn",
]);

const TRANSLATABLE_ATTRS = new Set([
  "placeholder", "title", "alt", "aria-label", "aria-description",
  "label", "tooltip", "description", "helperText",
]);

function shouldSkip(text) {
  if (text.length < 2) return true;
  if (text.length > 200) return true;
  return SKIP_PATTERNS.some((p) => p.test(text));
}

function getLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  // tree-sitter-javascript handles JS, JSX, TS, TSX all fine for our purposes
  return JavaScript;
}

function extractFromNode(node, sourceCode, filePath, results) {
  const type = node.type;

  // JSX text content: <button>Login</button>
  if (type === "jsx_text") {
    const text = node.text.trim();
    if (!shouldSkip(text)) {
      results.push({
        text,
        file: filePath,
        line: node.startPosition.row + 1,
        type: "jsx_text",
      });
    }
  }

  // JSX attributes: placeholder="Enter email"
  if (type === "jsx_attribute") {
    const nameNode = node.childForFieldName("name");
    const valueNode = node.childForFieldName("value");
    if (nameNode && valueNode) {
      const attrName = nameNode.text;
      if (TRANSLATABLE_ATTRS.has(attrName)) {
        // value is a string node: "Enter email"
        const strNode =
          valueNode.type === "string"
            ? valueNode
            : valueNode.namedChildren.find((c) => c.type === "string");
        if (strNode) {
          const text = strNode.text.slice(1, -1).trim(); // strip quotes
          if (!shouldSkip(text)) {
            results.push({
              text,
              file: filePath,
              line: strNode.startPosition.row + 1,
              type: "attribute",
            });
          }
        }
      }
    }
  }

  // String literals in function calls: toast.success("Saved!")
  if (type === "call_expression") {
    const fnNode = node.childForFieldName("function");
    const argsNode = node.childForFieldName("arguments");

    // Skip known non-translatable calls
    if (fnNode) {
      const fnText = fnNode.text.split(".")[0];
      if (SKIP_CALL_NAMES.has(fnText)) {
        // still recurse children but don't extract from this call's args
        for (const child of node.namedChildren) {
          extractFromNode(child, sourceCode, filePath, results);
        }
        return;
      }
    }

    if (argsNode) {
      for (const arg of argsNode.namedChildren) {
        if (arg.type === "string") {
          const text = arg.text.slice(1, -1).trim();
          if (!shouldSkip(text)) {
            results.push({
              text,
              file: filePath,
              line: arg.startPosition.row + 1,
              type: "literal",
            });
          }
        }
      }
    }
  }

  // Skip already-translated: {t('key')} — look for t() call
  if (
    type === "call_expression" &&
    node.childForFieldName("function")?.text === "t"
  ) {
    return; // don't recurse into t() calls
  }

  for (const child of node.namedChildren) {
    extractFromNode(child, sourceCode, filePath, results);
  }
}

export async function extractStrings(filePath) {
  const source = await fs.readFile(filePath, "utf-8");
  const language = getLanguage(filePath);
  parser.setLanguage(language);

  let tree;
  try {
    tree = parser.parse(source);
  } catch {
    return []; // skip unparseable files
  }

  const results = [];
  extractFromNode(tree.rootNode, source, filePath, results);

  // Deduplicate by text
  const seen = new Set();
  return results.filter((r) => {
    if (seen.has(r.text)) return false;
    seen.add(r.text);
    return true;
  });
}
