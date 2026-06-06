/**
 * ArtistHero: the calm first impression shared by the owner's app entry (the
 * Archive tab) and the public portfolio page. Both must feel identical: one
 * large hero, the artist name (always), and ONE optional line below it.
 *
 * The contract locked here is the optional second line — it renders only when
 * there is something to say, and trimmed whitespace counts as nothing.
 */
import { render } from "@testing-library/react-native";
import React from "react";

import { ArtistHero } from "@/components/ArtistHero";

describe("ArtistHero optional second line", () => {
  it("always shows the artist name", () => {
    const { getByText } = render(<ArtistHero name="Sang-Jeong Lee" />);
    expect(getByText("Sang-Jeong Lee")).toBeTruthy();
  });

  it("shows the second line when provided", () => {
    const { getByText } = render(
      <ArtistHero name="Sang-Jeong Lee" secondLine="Tree Eye Studio" />,
    );
    expect(getByText("Tree Eye Studio")).toBeTruthy();
  });

  it("omits the second line when empty", () => {
    const { queryByText } = render(
      <ArtistHero name="Sang-Jeong Lee" secondLine="" />,
    );
    // Name still present, but nothing else in the identity block.
    expect(queryByText("Sang-Jeong Lee")).toBeTruthy();
    expect(queryByText(/Studio|Clay/)).toBeNull();
  });

  it("treats whitespace-only second line as empty", () => {
    const { queryByText } = render(
      <ArtistHero name="Sang-Jeong Lee" secondLine="   " />,
    );
    expect(queryByText("   ")).toBeNull();
  });
});
