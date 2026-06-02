import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { strFromU8, unzipSync } from "fflate";
import { Platform } from "react-native";
import { definePDFJSModule, extractText, getDocumentProxy } from "unpdf";

installHermesPolyfills();

export interface ImportedText {
  text: string;
  fileName: string;
}

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type FileKind = "txt" | "docx" | "pdf";

/**
 * Opens the system document picker and returns plain text extracted from the
 * chosen file. Supports `.txt`, `.docx`, and `.pdf`.
 *
 * Returns `null` when the user cancels the picker.
 */
export async function pickAndExtractText(): Promise<ImportedText | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ["text/plain", DOCX_MIME, "application/pdf"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.[0]) return null;

  const asset = res.assets[0];
  const fileName = asset.name || "document";
  const kind = detectKind(fileName, asset.mimeType);

  let text: string;
  if (kind === "pdf") {
    text = await extractPdfText(await readAsBytes(asset));
  } else if (kind === "docx") {
    text = extractDocxText(await readAsBytes(asset));
  } else {
    text = await readAsText(asset);
  }

  return { text: normalizeText(text), fileName };
}

function detectKind(name: string, mime?: string | null): FileKind {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf") || mime === "application/pdf") return "pdf";
  if (lower.endsWith(".docx") || mime === DOCX_MIME) return "docx";
  // Default to plain-text extraction for .txt and anything unrecognized.
  return "txt";
}

// expo-document-picker exposes the underlying DOM File on web only.
function webFileOf(asset: DocumentPicker.DocumentPickerAsset): Blob | undefined {
  return (asset as { file?: Blob }).file;
}

async function readAsText(
  asset: DocumentPicker.DocumentPickerAsset
): Promise<string> {
  if (Platform.OS === "web") {
    const file = webFileOf(asset);
    if (file) return file.text();
    return (await fetch(asset.uri)).text();
  }
  return new File(asset.uri).text();
}

async function readAsBytes(
  asset: DocumentPicker.DocumentPickerAsset
): Promise<Uint8Array> {
  let buffer: ArrayBuffer;
  if (Platform.OS === "web") {
    const file = webFileOf(asset);
    buffer = file
      ? await file.arrayBuffer()
      : await (await fetch(asset.uri)).arrayBuffer();
  } else {
    buffer = await new File(asset.uri).arrayBuffer();
  }
  return new Uint8Array(buffer);
}

/**
 * A .docx is a ZIP whose `word/document.xml` holds the body. We unzip with
 * fflate (pure JS, Hermes-safe) and convert the WordprocessingML to text:
 * paragraphs become newlines, tabs/breaks are preserved, and all tags are
 * stripped so only the run text remains.
 */
function extractDocxText(bytes: Uint8Array): string {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new Error("Couldn’t read that .docx file — it may be corrupted.");
  }
  const docXml = entries["word/document.xml"];
  if (!docXml) {
    throw new Error("That .docx file doesn’t contain any readable text.");
  }
  const xml = strFromU8(docXml);
  const withBreaks = xml
    .replace(/<w:tab\b[^>]*\/?>/g, "\t")
    .replace(/<w:br\b[^>]*\/?>/g, "\n")
    .replace(/<\/w:p>/g, "\n");
  const stripped = withBreaks.replace(/<[^>]+>/g, "");
  return decodeXmlEntities(stripped);
}

let pdfjsReady: Promise<void> | null = null;

// Lazily load pdf.js (~1.6MB) only on first PDF import so it never costs app
// startup. The static `import("unpdf/pdfjs")` string keeps it in the Metro
// bundle while deferring evaluation.
function ensurePdfjs(): Promise<void> {
  if (!pdfjsReady) {
    // Clear the cache on failure so a transient init error can be retried on
    // the next PDF import instead of staying broken until app restart.
    pdfjsReady = definePDFJSModule(() => import("unpdf/pdfjs")).catch((err) => {
      pdfjsReady = null;
      throw err;
    });
  }
  return pdfjsReady;
}

/**
 * Extracts readable text from a PDF using unpdf's worker-free, canvas-free
 * pdf.js build (runs on Hermes). Any failure — corrupt file, unsupported
 * encoding, or a scanned/image-only PDF with no text layer — surfaces the same
 * friendly message.
 */
async function extractPdfText(bytes: Uint8Array): Promise<string> {
  try {
    await ensurePdfjs();
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    const merged = (Array.isArray(text) ? text.join("\n") : text).trim();
    if (!merged) throw new Error("no text layer");
    return merged;
  } catch {
    throw new Error("Unable to read this PDF.");
  }
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&amp;/g, "&");
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// pdf.js relies on a couple of platform globals that Hermes (React Native)
// doesn't provide. These are guarded no-ops on web, where they already exist.
function installHermesPolyfills(): void {
  const g = globalThis as Record<string, unknown>;

  if (typeof (Promise as { withResolvers?: unknown }).withResolvers !== "function") {
    (Promise as unknown as { withResolvers: <T>() => PromiseWithResolvers<T> }).withResolvers =
      function withResolvers<T>(): PromiseWithResolvers<T> {
        let resolve!: (value: T | PromiseLike<T>) => void;
        let reject!: (reason?: unknown) => void;
        const promise = new Promise<T>((res, rej) => {
          resolve = res;
          reject = rej;
        });
        return { promise, resolve, reject };
      };
  }

  if (typeof g.structuredClone !== "function") {
    g.structuredClone = (value: unknown) => deepClone(value, new WeakMap());
  }
}

function deepClone(value: unknown, seen: WeakMap<object, unknown>): unknown {
  if (value === null || typeof value !== "object") return value;
  const ref = value as object;
  const cached = seen.get(ref);
  if (cached !== undefined) return cached;
  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);
  if (value instanceof ArrayBuffer) return value.slice(0);
  if (ArrayBuffer.isView(value)) {
    if (value instanceof DataView) {
      return new DataView(
        value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
      );
    }
    const Ctor = (value as unknown as { constructor: new (input: unknown) => unknown })
      .constructor;
    return new Ctor(value);
  }
  if (Array.isArray(value)) {
    const arr: unknown[] = [];
    seen.set(ref, arr);
    for (let i = 0; i < value.length; i++) arr[i] = deepClone(value[i], seen);
    return arr;
  }
  if (value instanceof Map) {
    const map = new Map();
    seen.set(ref, map);
    value.forEach((v, k) => map.set(deepClone(k, seen), deepClone(v, seen)));
    return map;
  }
  if (value instanceof Set) {
    const set = new Set();
    seen.set(ref, set);
    value.forEach((v) => set.add(deepClone(v, seen)));
    return set;
  }
  const out: Record<string, unknown> = {};
  seen.set(ref, out);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    out[key] = deepClone((value as Record<string, unknown>)[key], seen);
  }
  return out;
}
