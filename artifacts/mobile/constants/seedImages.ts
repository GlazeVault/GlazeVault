import { File, Paths } from "expo-file-system";
import { ImageSource } from "expo-image";
import { Platform } from "react-native";

export const SEED_IMAGE_MAP: Record<string, ImageSource> = {
  "blue-mug": require("../assets/images/blue-mug.png"),
};

/**
 * Turns a stored image reference into a renderable source.
 *
 * - `@seed/<key>` → bundled asset.
 * - Native relative path (e.g. `pieces/123.jpg`, no scheme) → absolute URI under
 *   the current document directory. This is what `persistPieceImage` stores on
 *   native so photos survive the iOS container path changing between builds.
 * - Everything else (data:, http:, file://, web blob) → used as-is.
 */
export function resolveImageSource(uri: string | undefined | null): ImageSource {
  if (!uri) return { uri: undefined };
  if (uri.startsWith("@seed/")) {
    const key = uri.slice(6);
    return SEED_IMAGE_MAP[key] ?? { uri };
  }
  if (Platform.OS !== "web" && !uri.includes("://") && !uri.startsWith("data:")) {
    try {
      return { uri: new File(Paths.document, ...uri.split("/")).uri };
    } catch {
      return { uri };
    }
  }
  return { uri };
}
