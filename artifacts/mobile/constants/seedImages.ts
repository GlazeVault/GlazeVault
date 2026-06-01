import { ImageSource } from "expo-image";

export const SEED_IMAGE_MAP: Record<string, ImageSource> = {
  "blue-mug": require("../assets/images/blue-mug.png"),
};

export function resolveImageSource(uri: string): ImageSource {
  if (uri.startsWith("@seed/")) {
    const key = uri.slice(6);
    return SEED_IMAGE_MAP[key] ?? { uri };
  }
  return { uri };
}
