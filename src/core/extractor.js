import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import path from "path";
import fs from "fs-extra";

const parser = new Parser();

const SKIP_PATTERNS = [
  /^https?:\/\//,                          // URLs
  /^#[0-9a-fA-F]{3,8}$/,                  // Hex colors
  /^\s*$/,                                  // Whitespace only
  /^[0-9\s.,!?%+\-*/=<>|&^~]+$/,          // Numbers/operators only
  /^[a-z][a-zA-Z0-9]*$/,                   // camelCase identifiers
  /\.(js|ts|jsx|tsx|css|png|jpg|svg|gif|ico|woff|ttf)$/, // File references
  /^\//,                                    // Any path starting with /
  /[{}[\]=>]/,                              // Code fragments
  /\n/,                                     // Multi-line strings
  /^(true|false|null|undefined|NaN)$/,      // JS literals
  /^[A-Z][A-Z0-9_]+$/,                     // CONSTANTS
  /^[a-z_]+$/,                             // snake_case identifiers
  /^\w+:\s*\w/,                            // CSS/object properties
  /^[@#*]/,                                // Special prefixes
  /^\(.*\)$/,                              // Parenthesized expressions
  /^<.*>$/,                                // HTML/JSX tags
  /[=(){};]/,                              // Code syntax chars
];

const SKIP_CALL_NAMES = new Set([
  "console", "require", "import", "typeof", "instanceof",
  "className", "classNames", "clsx", "cn", "styles",
  "router", "navigate", "push", "replace", "redirect",
  "setTimeout", "setInterval", "clearTimeout", "clearInterval",
  "Object", "Array", "Math", "JSON", "Date", "Promise",
  "useState", "useEffect", "useRef", "useCallback", "useMemo",
  "queryKey", "format", "new",
]);

const TRANSLATABLE_CALL_NAMES = new Set([
  "toast", "alert", "confirm", "notify", "showToast",
  "showError", "showSuccess", "showWarning", "showInfo",
  "error", "success", "warning", "info",
]);

const TRANSLATABLE_ATTRS = new Set([
  "placeholder", "title", "alt", "aria-label", "aria-description",
  "label", "tooltip", "description", "helperText",
]);

function isHumanReadable(text) {
  const letters = (text.match(/[a-zA-ZÀ-ɏ؀-ۿऀ-ॿ]/g) || []).length;
  return letters / text.length >= 0.5;
}

function isFragment(text) {
  const trimmed = text.trim();
  // Starts with lowercase (incomplete sentence)
  if (/^[a-z]/.test(trimmed)) return true;
  // Ends mid-sentence with conjunction/preposition
  if (/\s(or|and|but|the|a|an|to|in|of|for|with|your|our)$/i.test(trimmed)) return true;
  // Has fewer than 2 words and doesn't look like a standalone label
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 1 && trimmed.length < 4) return true;
  return false;
}

function shouldSkip(text) {
  const trimmed = text.trim();
  if (trimmed.length < 3) return true;
  if (trimmed.length > 150) return true;
  if (SKIP_PATTERNS.some((p) => p.test(trimmed))) return true;
  if (!isHumanReadable(trimmed)) return true;
  if (isFragment(trimmed)) return true;
  return false;
}

function extractFromNode(node, sourceCode, filePath, results) {
  const type = node.type;

  // JSX text content: <button>Login</button>
  if (type === "jsx_text") {
    const text = node.text.trim();
    if (!shouldSkip(text)) {
      results.push({ text, file: filePath, line: node.startPosition.row + 1, type: "jsx_text" });
    }
    return;
  }

  // JSX attributes: placeholder="Enter email"
  if (type === "jsx_attribute") {
    const nameNode = node.namedChildren[0];
    const valueNode = node.namedChildren[1];
    if (nameNode && valueNode && TRANSLATABLE_ATTRS.has(nameNode.text)) {
      const strNode =
        valueNode.type === "string"
          ? valueNode
          : valueNode.namedChildren?.find((c) => c.type === "string");
      if (strNode) {
        const text = strNode.text.slice(1, -1).trim();
        if (!shouldSkip(text)) {
          results.push({ text, file: filePath, line: strNode.startPosition.row + 1, type: "attribute" });
        }
      }
    }
    return;
  }

  // String literals in known translatable calls: toast.success("Saved!")
  if (type === "call_expression") {
    const fnNode = node.childForFieldName("function");
    const fnText = fnNode?.text || "";
    const fnBase = fnText.split(".").pop() || fnText.split(".")[0];

    // Skip t() — already translated
    if (fnText === "t" || fnBase === "t") return;

    // Skip non-translatable calls entirely
    if (SKIP_CALL_NAMES.has(fnText.split(".")[0])) {
      for (const child of node.namedChildren) extractFromNode(child, sourceCode, filePath, results);
      return;
    }

    // Only extract strings from known translatable calls
    if (TRANSLATABLE_CALL_NAMES.has(fnBase)) {
      const argsNode = node.childForFieldName("arguments");
      if (argsNode) {
        for (const arg of argsNode.namedChildren) {
          if (arg.type === "string") {
            const text = arg.text.slice(1, -1).trim();
            if (!shouldSkip(text)) {
              results.push({ text, file: filePath, line: arg.startPosition.row + 1, type: "literal" });
            }
          }
        }
      }
    }

    // Always recurse children
    for (const child of node.namedChildren) extractFromNode(child, sourceCode, filePath, results);
    return;
  }

  for (const child of node.namedChildren) {
    extractFromNode(child, sourceCode, filePath, results);
  }
}

export async function extractStrings(filePath) {
  const source = await fs.readFile(filePath, "utf-8");
  parser.setLanguage(JavaScript);

  let tree;
  try {
    tree = parser.parse(source);
  } catch {
    return [];
  }

  const results = [];
  extractFromNode(tree.rootNode, source, filePath, results);

  const seen = new Set();
  return results.filter((r) => {
    if (seen.has(r.text)) return false;
    seen.add(r.text);
    return true;
  });
}
