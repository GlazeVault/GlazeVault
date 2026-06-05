/**
 * `savePiece` degraded-mode contract. A deployed Supabase database may predate a
 * column migration; the upsert then fails with a missing-column error (PGRST204 /
 * 42703) naming ONE column at a time. `savePiece` must strip exactly the named
 * optional column(s) and retry so the core piece still reaches the cloud, while
 * a missing CORE column still surfaces as a thrown error.
 *
 * The mocked supabase client returns a scripted sequence of upsert results. The
 * piece's photos are already-remote https URLs so `uploadImage` short-circuits
 * (no storage call needed).
 */
jest.mock("@/services/supabase", () => {
  const mockUpsert = jest.fn();
  return {
    __esModule: true,
    isSupabaseConfigured: true,
    IMAGE_BUCKET: "images",
    mockUpsert,
    supabase: {
      from: () => ({ upsert: mockUpsert }),
      storage: {
        from: () => ({
          upload: jest.fn(async () => ({ error: null })),
          getPublicUrl: () => ({ data: { publicUrl: "" } }),
        }),
      },
    },
  };
});

import * as supabaseModule from "@/services/supabase";
import { savePiece } from "@/services/dataService";
import type { PotteryPiece } from "@/context/PotteryContext";

const mockUpsert = (supabaseModule as unknown as { mockUpsert: jest.Mock })
  .mockUpsert;

const COVER = "https://example.com/cover.jpg";
const SECOND = "https://example.com/second.jpg";

function makePiece(): PotteryPiece {
  return {
    id: "p1",
    title: "Bowl",
    notes: "",
    clay: "",
    glaze: "",
    firing: "",
    cone: "",
    firingEnvironment: "",
    dimensions: "",
    year: "",
    imageUri: COVER,
    images: [COVER, SECOND],
    createdAt: "2026-01-01T00:00:00.000Z",
    isFavorite: false,
    collectionIds: [],
    featuredInPortfolio: false,
    isPublic: true,
    archived: false,
    showGlazeDetails: false,
    showStudioNotes: false,
  } as PotteryPiece;
}

const missing = (column: string) => ({
  error: { code: "PGRST204", message: `Could not find the '${column}' column` },
});

// The SUT reuses ONE row object across retries (mutating it via `delete`), so
// `mockUpsert.mock.calls` would all hold the same final-state reference. Snapshot
// a shallow copy at each call so per-attempt assertions reflect what was sent.
function scriptUpserts(results: Array<{ error: unknown }>) {
  const snapshots: Record<string, unknown>[] = [];
  let i = 0;
  mockUpsert.mockImplementation(async (row: Record<string, unknown>) => {
    snapshots.push({ ...row });
    return results[Math.min(i++, results.length - 1)];
  });
  return snapshots;
}

beforeEach(() => {
  mockUpsert.mockReset();
});

describe("savePiece degraded mode", () => {
  it("strips multiple missing optional columns one at a time, then succeeds", async () => {
    const snapshots = scriptUpserts([
      missing("image_urls"),
      missing("show_glaze_details"),
      { error: null },
    ]);

    await expect(savePiece(makePiece(), "user-1")).resolves.toBeTruthy();

    expect(mockUpsert).toHaveBeenCalledTimes(3);
    expect(snapshots[0]).toHaveProperty("image_urls");
    expect(snapshots[0]).toHaveProperty("show_glaze_details");

    // Final attempt has both reported-missing columns stripped but keeps the
    // remaining optional column and the core fields.
    const last = snapshots[2];
    expect(last).not.toHaveProperty("image_urls");
    expect(last).not.toHaveProperty("show_glaze_details");
    expect(last).toHaveProperty("show_studio_notes");
    expect(last.image_url).toBe(COVER);
    expect(last.is_public).toBe(true);
    expect(last.user_id).toBe("user-1");
  });

  it("only drops the column actually missing (keeps show_* when only image_urls is absent)", async () => {
    const snapshots = scriptUpserts([missing("image_urls"), { error: null }]);

    await expect(savePiece(makePiece(), "user-1")).resolves.toBeTruthy();

    expect(mockUpsert).toHaveBeenCalledTimes(2);
    const last = snapshots[1];
    expect(last).not.toHaveProperty("image_urls");
    expect(last).toHaveProperty("show_glaze_details");
    expect(last).toHaveProperty("show_studio_notes");
  });

  it("rethrows immediately when a CORE column is missing (no strip retry)", async () => {
    scriptUpserts([missing("user_id")]);

    await expect(savePiece(makePiece(), "user-1")).rejects.toBeTruthy();
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it("rethrows a non-missing-column error without retrying", async () => {
    scriptUpserts([{ error: { code: "23505", message: "duplicate key value" } }]);

    await expect(savePiece(makePiece(), "user-1")).rejects.toBeTruthy();
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });
});
