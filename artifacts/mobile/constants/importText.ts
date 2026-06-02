import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { Platform } from "react-native";

export interface ImportedText {
  text: string;
  fileName: string;
}

/**
 * Thrown when the user picks a file type we can't yet read on-device (currently
 * PDF). The caller shows the message as a friendly "coming soon" alert.
 */
export class UnsupportedFileError extends Error {}

/**
 * Opens the system document picker and returns plain text extracted from the
 * chosen file. Only `.txt` is supported on-device for now; PDF parsing requires
 * a server-side parser and is intentionally disabled here.
 *
 * Returns `null` when the user cancels the picker.
 */
export async function pickAndExtractText(): Promise<ImportedText | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ["text/plain", "application/pdf"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.[0]) return null;

  const asset = res.assets[0];
  const fileName = asset.name || "document";

  if (isPdf(fileName, asset.mimeType)) {
    throw new UnsupportedFileError(
      "PDF import is coming soon. Please use a .txt file for now."
    );
  }

  const text = await readAsText(asset);
  return { text: normalizeText(text), fileName };
}

function isPdf(name: string, mime?: string | null): boolean {
  return name.toLowerCase().endsWith(".pdf") || mime === "application/pdf";
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
