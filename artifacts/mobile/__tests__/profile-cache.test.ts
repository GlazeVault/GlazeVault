/**
 * Profile AsyncStorage cache must never inline base64 `data:` image payloads —
 * on web that overflows localStorage (~5MB) and blocks saves. These tests pin
 * the metadata-only strip applied before every cache write.
 */
import { DEFAULT_PUBLIC_SITE, toCacheSafeProfile } from "@/context/ProfileContext";
import type { ArtistProfile } from "@/context/ProfileContext";

const BASE: ArtistProfile = {
  name: "Test Artist",
  tagline: "",
  bio: "",
  statement: "",
  website: "",
  instagram: "",
  heroFocalY: 0.5,
  heroFocalX: 0.5,
  heroZoom: 1,
  publicSite: DEFAULT_PUBLIC_SITE,
};

describe("toCacheSafeProfile", () => {
  it("strips data: avatar and hero URIs from the cache snapshot", () => {
    const dataUri = "data:image/jpeg;base64," + "A".repeat(500_000);
    const cached = toCacheSafeProfile({
      ...BASE,
      avatarUri: dataUri,
      heroImageUri: dataUri,
    });
    expect(cached.avatarUri).toBeUndefined();
    expect(cached.heroImageUri).toBeUndefined();
    expect(cached.name).toBe("Test Artist");
  });

  it("keeps https Supabase URLs and native relative paths", () => {
    const https =
      "https://project.supabase.co/storage/v1/object/public/images/avatars/x.jpg";
    const relative = "pieces/123-abc.jpg";
    const cached = toCacheSafeProfile({
      ...BASE,
      avatarUri: https,
      heroImageUri: relative,
    });
    expect(cached.avatarUri).toBe(https);
    expect(cached.heroImageUri).toBe(relative);
  });
});
