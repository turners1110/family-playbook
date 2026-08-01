/**
 * Safe EPUB inspection and text extraction (ZIP/OPF/spine).
 * Detects DRM; never attempts circumvention.
 */
import JSZip from "jszip";
import { createHash } from "crypto";

export type EpubExtractionStatus =
  | "extracted"
  | "partial"
  | "drm_protected"
  | "failed";

export type EpubChapter = {
  chapterIndex: number;
  chapterTitle: string;
  sourceHref: string;
  wordCount: number;
  extractedText: string;
};

export type EpubInspectionResult = {
  status: EpubExtractionStatus;
  errorCode: string | null;
  errorMessage: string | null;
  drmProtected: boolean;
  title: string | null;
  author: string | null;
  publisher: string | null;
  language: string | null;
  identifier: string | null;
  chapterCount: number;
  totalWordCount: number;
  fullTextAvailable: boolean;
  chapters: EpubChapter[];
};

const DANGEROUS_PATH = /(\.\.|\\|\/\/|^\/)/;
const EXECUTABLE_EXT = /\.(exe|bat|cmd|sh|js|mjs|php|py|jar|wasm|dll|so)$/i;
const MAX_CHAPTERS = 500;
const MAX_CHAPTER_CHARS = 500_000;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|br|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wordCount(text: string): number {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

function xmlAttr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i");
  const m = tag.match(re);
  return m?.[1] ?? null;
}

function resolveHref(basePath: string, href: string): string {
  const clean = href.split("#")[0];
  if (!basePath.includes("/")) return clean;
  const dir = basePath.slice(0, basePath.lastIndexOf("/") + 1);
  const parts = (dir + clean).split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

function findHeading(html: string, fallback: string): string {
  const h = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
  if (h) {
    const title = stripHtml(h[1]).slice(0, 200);
    if (title) return title;
  }
  return fallback;
}

export function sha256Buffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function inspectAndExtractEpub(
  buffer: Buffer,
): Promise<EpubInspectionResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer, { checkCRC32: true });
  } catch {
    return fail("malformed_zip", "The file is not a valid EPUB/ZIP container.");
  }

  // Path traversal / executable payload checks
  for (const name of Object.keys(zip.files)) {
    if (DANGEROUS_PATH.test(name) || name.includes("\0")) {
      return fail("path_traversal", "EPUB contains unsafe path entries.");
    }
    if (EXECUTABLE_EXT.test(name) && !name.endsWith(".xhtml") && !name.endsWith(".html")) {
      // Allow .js only if we never execute; still reject standalone executables.
      if (/\.(exe|bat|cmd|sh|dll|so|jar|wasm)$/i.test(name)) {
        return fail("unsafe_payload", "EPUB contains unsafe executable payloads.");
      }
    }
  }

  const encryption = zip.file("META-INF/encryption.xml");
  if (encryption) {
    const encXml = await encryption.async("string");
    if (/EncryptedData|encryption|adept|Adobe|rights\.xml/i.test(encXml)) {
      return drm("drm_encryption_xml", "This EPUB appears to be DRM-protected.");
    }
  }
  if (zip.file("META-INF/rights.xml")) {
    return drm("drm_rights_xml", "This EPUB appears to be DRM-protected.");
  }

  const container = zip.file("META-INF/container.xml");
  if (!container) {
    return fail("missing_container", "EPUB is missing META-INF/container.xml.");
  }
  const containerXml = await container.async("string");
  const rootfileMatch = containerXml.match(
    /full-path\s*=\s*["']([^"']+\.opf)["']/i,
  );
  if (!rootfileMatch) {
    return fail("missing_opf", "EPUB container does not declare an OPF package.");
  }
  const opfPath = rootfileMatch[1];
  if (DANGEROUS_PATH.test(opfPath)) {
    return fail("path_traversal", "OPF path is unsafe.");
  }
  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    return fail("missing_opf_file", "Declared OPF package file is missing.");
  }
  const opfXml = await opfFile.async("string");

  const title =
    opfXml.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i)?.[1]?.trim() ?? null;
  const author =
    opfXml.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i)?.[1]?.trim() ??
    null;
  const publisher =
    opfXml.match(/<dc:publisher[^>]*>([\s\S]*?)<\/dc:publisher>/i)?.[1]?.trim() ??
    null;
  const language =
    opfXml.match(/<dc:language[^>]*>([\s\S]*?)<\/dc:language>/i)?.[1]?.trim() ??
    null;
  const identifier =
    opfXml.match(/<dc:identifier[^>]*>([\s\S]*?)<\/dc:identifier>/i)?.[1]?.trim() ??
    null;

  // Manifest id → href
  const manifest = new Map<string, { href: string; mediaType: string }>();
  const itemRe = /<item\b[^>]*>/gi;
  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemRe.exec(opfXml))) {
    const tag = itemMatch[0];
    const id = xmlAttr(tag, "id");
    const href = xmlAttr(tag, "href");
    const mediaType = xmlAttr(tag, "media-type") ?? "";
    if (id && href) manifest.set(id, { href, mediaType });
  }

  const spineIds: string[] = [];
  const spineRe = /<itemref\b[^>]*>/gi;
  let spineMatch: RegExpExecArray | null;
  while ((spineMatch = spineRe.exec(opfXml))) {
    const idref = xmlAttr(spineMatch[0], "idref");
    if (idref) spineIds.push(idref);
  }

  if (spineIds.length === 0) {
    return fail("empty_spine", "EPUB spine has no readable documents.");
  }

  const chapters: EpubChapter[] = [];
  let inaccessible = 0;

  for (let i = 0; i < Math.min(spineIds.length, MAX_CHAPTERS); i += 1) {
    const idref = spineIds[i];
    const item = manifest.get(idref);
    if (!item) {
      inaccessible += 1;
      continue;
    }
    if (
      item.mediaType &&
      !/html|xhtml|xml/i.test(item.mediaType) &&
      !/\.(x?html?|xml)$/i.test(item.href)
    ) {
      continue;
    }
    const resolved = resolveHref(opfPath, item.href);
    if (DANGEROUS_PATH.test(resolved)) {
      inaccessible += 1;
      continue;
    }
    const contentFile = zip.file(resolved);
    if (!contentFile) {
      inaccessible += 1;
      continue;
    }
    let html: string;
    try {
      html = await contentFile.async("string");
    } catch {
      inaccessible += 1;
      continue;
    }
    // Encrypted content often looks like binary garbage or empty after decode.
    if (!html || html.includes("EncryptedData") || /adobe.*drm/i.test(html)) {
      inaccessible += 1;
      continue;
    }
    const text = stripHtml(html).slice(0, MAX_CHAPTER_CHARS);
    if (text.length < 20) continue;
    chapters.push({
      chapterIndex: chapters.length,
      chapterTitle: findHeading(html, `Chapter ${chapters.length + 1}`),
      sourceHref: resolved,
      wordCount: wordCount(text),
      extractedText: text,
    });
  }

  if (chapters.length === 0 && inaccessible > 0) {
    return drm(
      "drm_unreadable_spine",
      "This EPUB appears to be DRM-protected. The app cannot read its book text.",
    );
  }

  if (chapters.length === 0) {
    return fail("no_readable_chapters", "No readable chapter text could be extracted.");
  }

  const totalWordCount = chapters.reduce((sum, c) => sum + c.wordCount, 0);
  const coverageRatio = chapters.length / Math.max(spineIds.length, 1);
  const fullTextAvailable = coverageRatio >= 0.8 && inaccessible === 0;
  const status: EpubExtractionStatus =
    fullTextAvailable ? "extracted" : inaccessible > 0 ? "partial" : "extracted";

  return {
    status,
    errorCode: null,
    errorMessage: null,
    drmProtected: false,
    title,
    author,
    publisher,
    language,
    identifier,
    chapterCount: chapters.length,
    totalWordCount,
    fullTextAvailable,
    chapters,
  };
}

function fail(code: string, message: string): EpubInspectionResult {
  return {
    status: "failed",
    errorCode: code,
    errorMessage: message,
    drmProtected: false,
    title: null,
    author: null,
    publisher: null,
    language: null,
    identifier: null,
    chapterCount: 0,
    totalWordCount: 0,
    fullTextAvailable: false,
    chapters: [],
  };
}

function drm(code: string, message: string): EpubInspectionResult {
  return {
    status: "drm_protected",
    errorCode: code,
    errorMessage: message,
    drmProtected: true,
    title: null,
    author: null,
    publisher: null,
    language: null,
    identifier: null,
    chapterCount: 0,
    totalWordCount: 0,
    fullTextAvailable: false,
    chapters: [],
  };
}

/** Build a minimal valid EPUB buffer for tests. */
export async function buildTestEpub(options?: {
  title?: string;
  author?: string;
  chapters?: Array<{ title: string; body: string }>;
  withDrm?: boolean;
}): Promise<Buffer> {
  const zip = new JSZip();
  const title = options?.title ?? "Test Book";
  const author = options?.author ?? "Test Author";
  const chapters = options?.chapters ?? [
    { title: "Chapter One", body: "<p>Hello world from chapter one with enough text.</p>" },
    { title: "Chapter Two", body: "<p>Second chapter content for extraction tests.</p>" },
  ];

  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
  );
  if (options?.withDrm) {
    zip.file(
      "META-INF/encryption.xml",
      `<?xml version="1.0"?><encryption><EncryptedData><EncryptionMethod Algorithm="http://ns.adobe.com/adept"/></EncryptedData></encryption>`,
    );
  }

  const manifestItems = chapters
    .map(
      (c, i) =>
        `<item id="c${i}" href="chap${i}.xhtml" media-type="application/xhtml+xml"/>`,
    )
    .join("");
  const spineItems = chapters.map((_, i) => `<itemref idref="c${i}"/>`).join("");
  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${title}</dc:title>
    <dc:creator>${author}</dc:creator>
    <dc:language>en</dc:language>
    <dc:identifier id="BookId">test-isbn-123</dc:identifier>
    <dc:publisher>Test Press</dc:publisher>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    ${manifestItems}
  </manifest>
  <spine toc="ncx">${spineItems}</spine>
</package>`,
  );
  zip.file(
    "OEBPS/toc.ncx",
    `<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><navMap></navMap></ncx>`,
  );
  chapters.forEach((c, i) => {
    zip.file(
      `OEBPS/chap${i}.xhtml`,
      `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${c.title}</title></head><body><h1>${c.title}</h1>${c.body}</body></html>`,
    );
  });

  const out = await zip.generateAsync({ type: "nodebuffer" });
  return Buffer.from(out);
}
