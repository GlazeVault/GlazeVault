import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

const PIECES_DIR = "pieces";

/**
 * Copies a picked image into permanent app storage and returns the new URI.
 *
 * Image picker / camera results live in a temporary cache that the OS can purge
 * at any time, so the raw picker URI must never be stored in piece data. On
 * native platforms this copies the file into `documentDirectory/pieces/` and
 * returns the permanent `file://` URI. On web (no document directory) and for
 * seed/asset references the original URI is returned untouched.
 *
 * Throws on native if the copy fails, so callers can block the save rather than
 * persisting a temporary cache URI that will later break.
 */
export async function persistPieceImage(uri: string): Promise<string> {
  if (!uri) return uri;
  if (Platform.OS === "web") return uri;
  if (uri.startsWith("@seed")) return uri;

  const dir = new Directory(Paths.document, PIECES_DIR);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }

  // Already persisted inside our pieces directory — nothing to copy.
  if (uri.startsWith(dir.uri)) return uri;

  const source = new File(uri);
  const ext = source.extension || ".jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
  const dest = new File(dir, filename);
  source.copy(dest);
  return dest.uri;
}
