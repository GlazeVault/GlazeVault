/**
 * `loadPublicProfileBySlug` resolution contract.
 *
 * Regression guard for the "Not on view" bug: the `profiles` table has NO
 * `created_at` column, so this loader must NOT order the query server-side —
 * doing so makes PostgREST return a 400 that bubbles up through
 * `PublicArtistProvider` and renders EVERY anonymous public link as "Not on
 * view". The mock's query builder exposes an `.order()` that throws, so any
 * reintroduction of server-side ordering fails this test loudly.
 *
 * It also pins deterministic same-slug resolution: when two enabled profiles
 * normalize to the same slug, the winner is the lexicographically smallest
 * `user_id` (sorted in memory), never backend row order.
 */
let mockRows: Record<string, unknown>[] = [];

jest.mock("@/services/supabase", () => {
  const orderSpy = jest.fn(() => {
    throw new Error(
      "loadPublicProfileBySlug must not order the profiles query server-side " +
        "(profiles has no created_at column → PostgREST 400)",
    );
  });
  return {
    __esModule: true,
    isSupabaseConfigured: true,
    IMAGE_BUCKET: "images",
    orderSpy,
    supabase: {
      from: () => ({
        select: () => ({
          order: orderSpy,
          then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
            Promise.resolve({ data: mockRows, error: null }).then(onF, onR),
        }),
      }),
    },
  };
});

import * as supabaseModule from "@/services/supabase";
import { loadPublicProfileBySlug } from "@/services/dataService";

const orderSpy = (supabaseModule as unknown as { orderSpy: jest.Mock }).orderSpy;

beforeEach(() => {
  mockRows = [];
  orderSpy.mockClear();
});

describe("loadPublicProfileBySlug", () => {
  it("resolves an enabled profile by its name-derived slug without server-side ordering", async () => {
    mockRows = [
      { user_id: "u-1", name: "Studio Aria", public_site: { enabled: true } },
    ];

    const found = await loadPublicProfileBySlug("studio-aria");

    expect(found?.userId).toBe("u-1");
    expect(orderSpy).not.toHaveBeenCalled();
  });

  it("picks the deterministic winner (smallest user_id) for a same-slug collision", async () => {
    mockRows = [
      { user_id: "u-2", name: "Studio Aria", public_site: { enabled: true } },
      { user_id: "u-1", name: "Studio Aria", public_site: { enabled: true } },
    ];

    const found = await loadPublicProfileBySlug("studio-aria");

    expect(found?.userId).toBe("u-1");
  });

  it("ignores profiles whose public site is disabled or that lack a user_id", async () => {
    mockRows = [
      { user_id: "u-3", name: "Studio Aria", public_site: { enabled: false } },
      { user_id: null, name: "Studio Aria", public_site: { enabled: true } },
    ];

    const found = await loadPublicProfileBySlug("studio-aria");

    expect(found).toBeNull();
  });
});
