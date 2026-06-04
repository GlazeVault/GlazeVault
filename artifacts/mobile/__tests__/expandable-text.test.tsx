/**
 * ExpandableText: editorial read-more used for the artist statement, bio, and
 * collection descriptions.
 *
 * The preview is computed deterministically (no layout measurement) so it
 * behaves identically on web and native. The two things that matter most:
 *   1. The preview NEVER cuts mid-word — it ends at a sentence/paragraph
 *      boundary, falling back to a whole-word cut only for a single over-long
 *      opening sentence.
 *   2. Long text always exposes a way to expand; short text shows no toggle.
 */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { ExpandableText, buildPreview } from "@/components/ExpandableText";

// A statement of short, complete sentences on manual line breaks: modest char
// count but visually well past a 6-line preview.
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

describe("ExpandableText rendering", () => {
  it("shows the expand control for long text", () => {
    const { getByText } = renderText();
    expect(getByText("Read Full Statement")).toBeTruthy();
  });

  it("toggles between preview and full text inline", () => {
    const { getByText, queryByText } = renderText();
    expect(queryByText("Show Less")).toBeNull();
    fireEvent.press(getByText("Read Full Statement"));
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

describe("buildPreview boundary behavior", () => {
  it("returns the full text untouched when it already fits", () => {
    const text = "Short enough to show in full.";
    const result = buildPreview(text, 6);
    expect(result.truncated).toBe(false);
    expect(result.preview).toBe(text);
  });

  it("cuts at a sentence boundary, never mid-word", () => {
    const text =
      "I grew up near the kilns of Gyeongju. The clay there is iron-rich and dark. " +
      "I learned to listen to the fire before I learned to throw. " +
      "Every glaze is a small argument with chance. " +
      "Some mornings the work surprises even me, and I realize how little I control. " +
      "The rest is patience and ash.";
    const result = buildPreview(text, 6);
    expect(result.truncated).toBe(true);
    expect(result.clean).toBe(true);
    // An exact prefix of the source => no characters were altered or clipped.
    expect(text.startsWith(result.preview)).toBe(true);
    // Ends on terminal punctuation, not a partial word like "I realize ho".
    expect(/[.!?]["'”’)\]]*$/.test(result.preview)).toBe(true);
  });

  it("falls back to a whole-word cut for one over-long sentence", () => {
    // 80 words, a single sentence: no internal boundary fits the budget.
    const text = `${Array.from({ length: 80 }, () => "word").join(" ")}.`;
    const result = buildPreview(text, 6);
    expect(result.truncated).toBe(true);
    expect(result.clean).toBe(false);
    // Still an exact prefix, and the cut lands on a word boundary.
    expect(text.startsWith(result.preview)).toBe(true);
    expect(/\s/.test(text[result.preview.length] ?? " ")).toBe(true);
  });

  it("does not end a preview on an abbreviation followed by lowercase", () => {
    // With a 1-line budget the only in-budget '.' is the one in "e.g." — it must
    // be skipped so the preview never reads as if a sentence ended there.
    const text =
      "Aged in ash, e.g. pine and oak, the surface deepens slowly over many firings.";
    const result = buildPreview(text, 1);
    expect(result.preview.endsWith("e.g.")).toBe(false);
    expect(result.clean).toBe(false);
  });

  it("cuts at a line boundary for punctuation-free manual breaks", () => {
    const lines = [
      "Stoneware vessels",
      "Wood-fired surfaces",
      "Natural ash glaze",
      "Gyeongju clay body",
      "Reduction cooled",
    ];
    const result = buildPreview(lines.join("\n"), 3);
    expect(result.truncated).toBe(true);
    expect(result.clean).toBe(true);
    expect(result.preview).toBe(lines.slice(0, 3).join("\n"));
  });

  it("hard-caps a single unbreakable token to the line budget", () => {
    const text = "x".repeat(500);
    const result = buildPreview(text, 2);
    expect(result.truncated).toBe(true);
    expect(result.clean).toBe(false);
    expect(text.startsWith(result.preview)).toBe(true);
    expect(result.preview.length).toBeLessThanOrEqual(2 * 38);
  });

  it("does not end a preview on an abbreviation followed by a capital", () => {
    // "Dr." precedes a capitalised name, which the lowercase heuristic alone
    // would miss; the denylist must keep it from reading as a sentence end.
    const text =
      "Trained under Dr. Kim in Seoul for several long and formative years of study.";
    const result = buildPreview(text, 1);
    expect(result.preview.endsWith("Dr.")).toBe(false);
  });

  it("cuts at CJK terminal punctuation", () => {
    const text =
      "도자기는 흙으로 만듭니다。 가마에서 천천히 구워집니다。 유약은 불 속에서 변합니다。 마지막 소성까지 기다립니다。";
    const result = buildPreview(text, 1);
    expect(result.truncated).toBe(true);
    expect(result.clean).toBe(true);
    expect(result.preview.endsWith("。")).toBe(true);
  });
});
