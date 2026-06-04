/**
 * ExpandableText: editorial read-more used for the artist statement and
 * collection descriptions.
 *
 * The critical behavior is the WEB path: react-native-web never fires
 * onTextLayout, so whether the "Read more" control appears is decided by a
 * newline-aware line estimate — not by measured layout. jest-expo renders the
 * native tree but also never fires onTextLayout here, so these tests exercise
 * exactly that estimate-only path. They guard the two failure modes the design
 * is prone to: long text that stays clamped with no way to expand, and a short
 * blurb that should show no toggle at all.
 */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { ExpandableText } from "@/components/ExpandableText";

// A statement written with many short MANUAL line breaks: its character count
// is modest but it visually runs well past a 6-line preview. A plain
// char-count threshold would miss this and trap the reader in the preview.
const MANUAL_BREAK_STATEMENT = [
  "I work in stoneware.",
  "Each piece is wood-fired.",
  "The kiln decides the surface.",
  "Ash settles where it will.",
  "I only set the conditions.",
  "Then I wait for the unloading.",
  "Some survive. Some do not.",
  "The ones that remain, remain.",
].join("\n");

function renderText(props?: Partial<React.ComponentProps<typeof ExpandableText>>) {
  return render(
    <ExpandableText
      text={MANUAL_BREAK_STATEMENT}
      color="#000"
      collapsedLines={6}
      moreLabel="Read Full Statement"
      lessLabel="Show Less"
      {...props}
    />,
  );
}

describe("ExpandableText", () => {
  it("shows the expand control for long, manually-broken text (web estimate path)", () => {
    const { getByText } = renderText();
    // The toggle must exist even though onTextLayout never fired.
    expect(getByText("Read Full Statement")).toBeTruthy();
  });

  it("toggles between preview and full text inline", () => {
    const { getByText, queryByText } = renderText();
    expect(queryByText("Show Less")).toBeNull();
    fireEvent.press(getByText("Read Full Statement"));
    // Now expanded: label flips and there is a way back.
    expect(getByText("Show Less")).toBeTruthy();
    expect(queryByText("Read Full Statement")).toBeNull();
  });

  it("hides the toggle for text that fits within the preview", () => {
    const { queryByText } = renderText({
      text: "A short, single-line description.",
    });
    expect(queryByText("Read Full Statement")).toBeNull();
  });
});
