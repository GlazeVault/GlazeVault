/**
 * persistPieceImage is the gate every saved photo passes through. A regression
 * here silently loses or corrupts a user's photos on the next refresh, so these
 * tests pin its two responsibilities:
 *
 *   1. Idempotent pass-through. Several inputs are ALREADY safe to persist and
 *      must be returned byte-for-byte untouched: `@seed` refs, `data:` URIs,
 *      already-uploaded `http(s)://` remote URLs, and (on native) scheme-less
 *      relative paths that were persisted on a previous run. This matters most
 *      for metadata-only edits: once a piece syncs to Supabase its `imageUri`
 *      is a remote Storage URL, and re-storing that (re-fetching on web, or
 *      copying it as a local file on native) would throw and abort the save.
 *
 *   2. Platform-specific capture of a freshly-picked image. The picker hands
 *      back a temporary URI the OS can purge at any moment, so it must be moved
 *      to durable storage:
 *        - web: inlined as a base64 `data:` URI (survives page reloads), and
 *        - native: copied into `documentDirectory/pieces/` with a RELATIVE path
 *          returned (the absolute container path changes between installs).
 *
 * expo-file-system and `Platform.OS` are mocked so both branches run under the
 * node test environment. Per jest's factory-hoisting rule, the expo-file-system
 * mock is fully self-contained (it exposes its copy spy as `__copy` rather than
 * referencing an outer variable).
 */
import { Platform } from "react-native";

import { persistPieceImage } from "@/constants/imageStorage";

jest.mock("expo-file-system", () => {
  const copy = jest.fn();
  class MockDirectory {
    args: unknown[];
    constructor(...args: unknown[]) {
      this.args = args;
    }
    get exists() {
      return true;
    }
    create() {}
  }
  class MockFile {
    uri?: string;
    dir?: unknown;
    name?: string;
    constructor(...args: unknown[]) {
      if (args.length === 1) {
        this.uri = args[0] as string;
      } else {
        this.dir = args[0];
        this.name = args[1] as string;
      }
    }
    get extension(): string {
      const match = this.uri?.match(/(\.[a-z0-9]+)$/i);
      return match ? match[0] : "";
    }
    copy(dest: unknown) {
      copy(this, dest);
    }
  }
  return {
    Paths: { document: "file:///documents/" },
    Directory: MockDirectory,
    File: MockFile,
    __copy: copy,
  };
});

function setPlatform(os: string) {
  (Platform as { OS: string }).OS = os;
}

const ORIGINAL_OS = Platform.OS;

afterEach(() => {
  setPlatform(ORIGINAL_OS);
  jest.clearAllMocks();
});

describe("persistPieceImage pass-through (idempotent on already-safe inputs)", () => {
  it("returns an empty input untouched", async () => {
    await expect(persistPieceImage("")).resolves.toBe("");
  });

  it("returns @seed refs untouched", async () => {
    setPlatform("ios");
    await expect(persistPieceImage("@seed/blue-mug")).resolves.toBe("@seed/blue-mug");
    // Even on web, a seed ref must short-circuit before any fetch.
    setPlatform("web");
    await expect(persistPieceImage("@seed/blue-mug")).resolves.toBe("@seed/blue-mug");
  });

  it("returns data: URIs untouched", async () => {
    const dataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    setPlatform("ios");
    await expect(persistPieceImage(dataUri)).resolves.toBe(dataUri);
    setPlatform("web");
    await expect(persistPieceImage(dataUri)).resolves.toBe(dataUri);
  });

  it("returns already-uploaded http(s):// remote URLs untouched", async () => {
    const httpUrl = "http://cdn.example.com/pieces/x.jpg";
    const httpsUrl = "https://project.supabase.co/storage/v1/object/public/pieces/x.jpg";
    setPlatform("ios");
    await expect(persistPieceImage(httpUrl)).resolves.toBe(httpUrl);
    await expect(persistPieceImage(httpsUrl)).resolves.toBe(httpsUrl);
    // A metadata-only edit on web must NOT re-fetch a remote URL.
    setPlatform("web");
    await expect(persistPieceImage(httpsUrl)).resolves.toBe(httpsUrl);
  });

  it("returns already-persisted scheme-less relative paths untouched (native)", async () => {
    setPlatform("ios");
    const relative = "pieces/1700000000000-abc1234.jpg";
    await expect(persistPieceImage(relative)).resolves.toBe(relative);
    // No copy happens for an already-persisted path.
    const { __copy } = require("expo-file-system");
    expect(__copy).not.toHaveBeenCalled();
  });
});

describe("persistPieceImage web branch (inlines as a data: URI)", () => {
  beforeEach(() => {
    setPlatform("web");
    (global as { fetch?: unknown }).fetch = jest.fn(async () => ({
      blob: async () => "BLOB",
    }));
    (global as { FileReader?: unknown }).FileReader = class {
      result: string | null = null;
      onloadend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL(_blob: unknown) {
        this.result = "data:image/jpeg;base64,QUJDREVG";
        this.onloadend?.();
      }
    };
  });

  afterEach(() => {
    delete (global as { fetch?: unknown }).fetch;
    delete (global as { FileReader?: unknown }).FileReader;
  });

  it("reads a freshly-picked blob: URI into a base64 data: URI", async () => {
    const result = await persistPieceImage("blob:http://localhost/abc-123");
    expect(result).toBe("data:image/jpeg;base64,QUJDREVG");
    expect(result.startsWith("data:")).toBe(true);
    expect((global as unknown as { fetch: jest.Mock }).fetch).toHaveBeenCalledWith(
      "blob:http://localhost/abc-123",
    );
  });
});

describe("persistPieceImage native branch (copies into pieces/ and returns a relative path)", () => {
  it("copies a freshly-picked file:// URI into pieces/ and returns a relative path", async () => {
    setPlatform("ios");
    const result = await persistPieceImage("file:///var/tmp/ImagePicker/photo.png");
    // Relative path under pieces/, never an absolute file:// URI.
    expect(result).toMatch(/^pieces\/.+\.png$/);
    expect(result.startsWith("file://")).toBe(false);
    expect(result).not.toContain("://");
    // The source file was actually copied into durable storage.
    const { __copy } = require("expo-file-system");
    expect(__copy).toHaveBeenCalledTimes(1);
  });

  it("falls back to a .jpg extension when the source has none", async () => {
    setPlatform("android");
    const result = await persistPieceImage("file:///var/tmp/ImagePicker/noext");
    expect(result).toMatch(/^pieces\/.+\.jpg$/);
  });

  it("returns a unique relative path for each call (no filename collisions)", async () => {
    setPlatform("ios");
    const a = await persistPieceImage("file:///var/tmp/a.jpg");
    const b = await persistPieceImage("file:///var/tmp/b.jpg");
    expect(a).not.toBe(b);
  });
});
