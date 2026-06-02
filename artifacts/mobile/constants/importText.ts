import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { strFromU8, unzipSync } from "fflate";
import { Platform } from "react-native";

export interface ImportedText {
  text: string;
  fileName: string;
}

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type FileKind = "txt" | "docx" | "pdf";

/**
 * Opens the system document picker and returns plain text extracted from the
 * chosen file. Supports `.txt` and `.docx` today; `.pdf` is intentionally
 * rejected with a friendly message until proper PDF parsing is added.
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

  if (kind === "pdf") {
    throw new Error(
      "PDF import isn’t supported yet. Please use a .txt or .docx file."
    );
  }

  const text =
    kind === "docx"
      ? extractDocxText(await readAsBytes(asset))
      : await readAsText(asset);

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
