import { access, readFile, readdir, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const DIST_DIR = resolve("dist");
const MANIFEST_PATH = resolve(DIST_DIR, "manifest.json");
const CONTENT_PATH = resolve(DIST_DIR, "assets/content.js");
const FONT_LICENSE_PATH = resolve(DIST_DIR, "licenses/Pretendard-LICENSE.txt");
const SOURCE_FONT_LICENSE_PATH = resolve("assets/fonts/Pretendard-LICENSE.txt");
const BROAD_RESOURCE_PATTERN = /[*?[\]{}]/u;
const EXTERNAL_URL_PATTERN = /https?:\/\/[a-z0-9.-]+(?::\d+)?(?:[/?#][^\s"'`)\\]*)?/giu;
const ROOT_RELATIVE_ASSET_URL_PATTERN = /(?:["'`(=:]\s*)\/assets\//u;
const NON_NETWORK_URLS = new Set(["http://www.w3.org/2000/svg"]);
const EXPECTED_WEB_ACCESSIBLE_RESOURCES = new Set([
  "src/pages/blocked/index.html",
  "assets/focuswhale-atlas.png",
  "assets/PretendardVariable.woff2",
  "icons/focuswhale-128.png"
]);
const REQUIRED_CONTENT_ASSET_PATHS = [
  "assets/focuswhale-atlas.png",
  "assets/PretendardVariable.woff2"
];
const REQUIRED_LOCALIZED_PATHS = [
  "src/pages/onboarding/index.html",
  "_locales/en/messages.json",
  "_locales/ko/messages.json"
];

await Promise.all([waitForPath(MANIFEST_PATH), waitForPath(CONTENT_PATH), waitForPath(FONT_LICENSE_PATH)]);
const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
const content = await readFile(CONTENT_PATH, "utf8");
const contentSize = (await stat(CONTENT_PATH)).size;
const [packagedFontLicense, sourceFontLicense] = await Promise.all([
  readFile(FONT_LICENSE_PATH, "utf8"),
  readFile(SOURCE_FONT_LICENSE_PATH, "utf8")
]);

if (packagedFontLicense !== sourceFontLicense) {
  throw new Error("Packaged Pretendard license does not exactly match the source license.");
}

const requiredPaths = [
  manifest.background?.service_worker,
  manifest.action?.default_popup,
  manifest.options_page,
  ...(manifest.content_scripts ?? []).flatMap((entry) => entry.js ?? [])
].filter((value) => typeof value === "string");

if (manifest.default_locale !== "en") {
  throw new Error("Manifest default_locale must be en for the supported locale fallback.");
}
if (manifest.name !== "__MSG_appName__" || manifest.description !== "__MSG_appDescription__") {
  throw new Error("Manifest name and description must use localized message keys.");
}

const webAccessibleResources = (manifest.web_accessible_resources ?? [])
  .flatMap((entry) => entry.resources ?? []);

for (const resource of webAccessibleResources) {
  if (typeof resource !== "string" || resource.length === 0) {
    throw new Error("Manifest contains an invalid web-accessible resource declaration.");
  }
  if (BROAD_RESOURCE_PATTERN.test(resource)) {
    throw new Error(`Manifest contains a broad web-accessible resource glob: ${resource}`);
  }
}

if (new Set(webAccessibleResources).size !== webAccessibleResources.length) {
  throw new Error("Manifest contains duplicate web-accessible resource declarations.");
}

const declaredResourceSet = new Set(webAccessibleResources);
const missingResources = [...EXPECTED_WEB_ACCESSIBLE_RESOURCES]
  .filter((resource) => !declaredResourceSet.has(resource));
const unexpectedResources = [...declaredResourceSet]
  .filter((resource) => !EXPECTED_WEB_ACCESSIBLE_RESOURCES.has(resource));
if (missingResources.length > 0 || unexpectedResources.length > 0) {
  throw new Error(
    `Manifest web-accessible resources differ from the release allowlist. Missing: ${missingResources.join(", ") || "none"}; unexpected: ${unexpectedResources.join(", ") || "none"}.`
  );
}

requiredPaths.push(...webAccessibleResources, ...REQUIRED_LOCALIZED_PATHS);

for (const relativePath of requiredPaths) {
  await waitForPath(resolve(DIST_DIR, relativePath));
}

const forbiddenContentPatterns = [
  { pattern: /(^|[;\n])\s*import(?:\s|\()/m, label: "ES module import" },
  { pattern: /(^|[;\n])\s*export\s/m, label: "ES module export" },
  { pattern: /\bimport\.meta\b/, label: "import.meta" }
];

for (const { pattern, label } of forbiddenContentPatterns) {
  if (pattern.test(content)) {
    throw new Error(`MV3 content script contains unsupported ${label}: assets/content.js`);
  }
}

if (ROOT_RELATIVE_ASSET_URL_PATTERN.test(content)) {
  throw new Error("MV3 content script contains a root-relative /assets/ URL instead of an extension URL.");
}

if (!content.includes("chrome.runtime.getURL")) {
  throw new Error("MV3 content script does not resolve packaged assets through chrome.runtime.getURL.");
}

for (const assetPath of REQUIRED_CONTENT_ASSET_PATHS) {
  if (!content.includes(assetPath)) {
    throw new Error(`MV3 content script does not reference the stable packaged asset path: ${assetPath}`);
  }
}

if (contentSize > 500_000) {
  throw new Error(`MV3 content script is unexpectedly large: ${contentSize} bytes.`);
}

const outputFiles = await listFiles(DIST_DIR);
const mapFiles = outputFiles.filter((path) => path.endsWith(".map"));
if (mapFiles.length > 0) {
  throw new Error(`Production build contains source maps: ${mapFiles.map(toDistPath).join(", ")}`);
}

const scannableFiles = outputFiles.filter((path) => /\.(?:css|html|js|json)$/u.test(path));
for (const path of scannableFiles) {
  const source = await readFile(path, "utf8");
  const urls = source.match(EXTERNAL_URL_PATTERN) ?? [];
  const unexpectedUrls = urls.filter((url) => !NON_NETWORK_URLS.has(url));
  if (unexpectedUrls.length > 0) {
    throw new Error(
      `Build contains an unexpected external URL in ${toDistPath(path)}: ${unexpectedUrls[0]}`
    );
  }
}

console.log(
  `Verified ${requiredPaths.length} manifest targets, ${webAccessibleResources.length} exact web-accessible resources, no source maps, root-relative asset URLs, or external network URLs, the Pretendard license, and classic content-script output (${contentSize} bytes).`
);

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return files.flat();
}

function toDistPath(path) {
  return relative(DIST_DIR, path);
}

async function waitForPath(path, attempts = 40) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await access(path);
      return;
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }
      await delay(50);
    }
  }
}
