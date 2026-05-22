const SKIP_DIRS = new Set(["src", "app", "pages", "views", "screens", "features"]);
const GENERIC_FILENAMES = new Set(["index", "page", "layout", "app", "root"]);

export function getNamespace(filePath) {
  const parts = filePath.replace(/\\/g, "/").split("/").filter(Boolean);

  // Strip top-level generic dirs
  while (parts.length > 0 && SKIP_DIRS.has(parts[0])) {
    parts.shift();
  }

  if (parts.length === 0) return "common";

  // Remove Next.js route groups like (auth), (root)
  const first = parts[0].replace(/^\(|\)$/g, "");

  // Single file remaining → use filename as namespace
  if (parts.length === 1) {
    const name = first.replace(/\.(tsx?|jsx?)$/, "").toLowerCase();
    return GENERIC_FILENAMES.has(name) ? "home" : name;
  }

  // Folder is named something generic → use filename
  if (GENERIC_FILENAMES.has(first.toLowerCase())) {
    const fileName = parts[parts.length - 1].replace(/\.(tsx?|jsx?)$/, "").toLowerCase();
    return GENERIC_FILENAMES.has(fileName) ? "home" : fileName;
  }

  return first.toLowerCase();
}

// text → "namespace.flatKey"
export function applyNamespaces(allStrings, flatStringMap) {
  const textToNamespace = new Map();
  for (const { text, file } of allStrings) {
    if (!textToNamespace.has(text)) {
      textToNamespace.set(text, getNamespace(file));
    }
  }

  const namespaced = {};
  for (const [text, flatKey] of Object.entries(flatStringMap)) {
    const ns = textToNamespace.get(text) || "common";
    namespaced[text] = `${ns}.${flatKey}`;
  }
  return namespaced;
}

// { en: { login: "Login" } } → { en: { auth: { login: "Login" } } }
export function nestTranslations(flatTranslations, flatStringMap, namespacedStringMap) {
  // flatKey → namespacedKey (e.g. "login" → "auth.login")
  const flatToNamespaced = {};
  for (const [text, namespacedKey] of Object.entries(namespacedStringMap)) {
    const flatKey = flatStringMap[text];
    if (flatKey) flatToNamespaced[flatKey] = namespacedKey;
  }

  const nested = {};
  for (const [lang, flatKeys] of Object.entries(flatTranslations)) {
    nested[lang] = {};
    for (const [flatKey, value] of Object.entries(flatKeys)) {
      const dottedKey = flatToNamespaced[flatKey] || flatKey;
      setNested(nested[lang], dottedKey, value);
    }
  }
  return nested;
}

function setNested(obj, dottedKey, value) {
  const parts = dottedKey.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]]) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}
