import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

// Rough column-width estimate. We never measure real layout (react-native-web
// does not fire onTextLayout), so the preview is computed deterministically from
// this estimate — the same result on web and native.
const APPROX_CHARS_PER_LINE = 38;

// Estimate rendered line count without layout: count each explicit line break,
// and within each segment account for soft wrapping. Counting newlines matters
// because statements/bios often use short manual line breaks that a plain
// character count would under-count.
function estimateLineCount(text: string): number {
  return text
    .split("\n")
    .reduce(
      (total, segment) =>
        total + Math.max(1, Math.ceil(segment.length / APPROX_CHARS_PER_LINE)),
      0,
    );
}

// Sentence end OR paragraph/line break — the only places we may cut a preview,
// so it always ends cleanly and never mid-word. CJK terminal punctuation
// (。！？) stands alone (CJK has no inter-word spaces); ASCII terminal
// punctuation additionally requires a trailing space/end, which screens out most
// decimals and URLs.
const BOUNDARY = /[。！？]["'”’)\]]*|[.!?]["'”’)\]]*(?=\s|$)|\n+/g;

// Common abbreviations whose trailing dot is not a sentence end. The lowercase
// heuristic below already catches abbreviations followed by a lowercase word;
// this list also catches those followed by a capitalised word ("Dr. Kim",
// "U.S. Army") that the heuristic would miss.
const ABBREVIATIONS =
  /\b(?:mr|mrs|ms|dr|prof|sr|jr|st|vs|etc|no|fig|e\.g|i\.e|u\.s)\.$/i;

/**
 * Build a short preview that ends at a clean boundary.
 *
 * - Returns the full text untouched when it already fits within `collapsedLines`.
 * - Otherwise cuts at the LAST sentence or paragraph boundary that still fits the
 *   line budget (`clean: true`, no ellipsis needed — the "Read more" control
 *   signals continuation).
 * - Only when a single opening sentence is itself longer than the budget does it
 *   fall back to a whole-word cut (`clean: false`), which the renderer marks with
 *   an ellipsis. It never cuts in the middle of a word.
 */
export function buildPreview(
  text: string,
  collapsedLines: number,
): { preview: string; truncated: boolean; clean: boolean } {
  const trimmed = text.trim();
  if (estimateLineCount(trimmed) <= collapsedLines) {
    return { preview: trimmed, truncated: false, clean: true };
  }

  const budget = collapsedLines * APPROX_CHARS_PER_LINE;
  let lastBoundary = 0;
  let match: RegExpExecArray | null;
  BOUNDARY.lastIndex = 0;
  while ((match = BOUNDARY.exec(trimmed)) !== null) {
    const isNewline = match[0].startsWith("\n");
    // Cut before a bare line break, but after sentence punctuation.
    const end = isNewline ? match.index : match.index + match[0].length;
    if (end <= 0) continue;
    // The line estimate only grows with the prefix, so once one boundary
    // overflows the budget, every later one does too.
    if (estimateLineCount(trimmed.slice(0, end)) > collapsedLines) break;
    // Skip likely abbreviations: a known abbreviation ("Dr.", "U.S."), or a
    // sentence "." followed by a lowercase continuation ("e.g. pine"). A real
    // sentence end is followed by an uppercase letter, a quote, or end of text.
    if (!isNewline) {
      const head = trimmed.slice(0, end);
      if (ABBREVIATIONS.test(head)) continue;
      const next = trimmed.slice(end).trimStart()[0];
      if (next && /[a-z]/.test(next)) continue;
    }
    lastBoundary = end;
  }

  if (lastBoundary > 0) {
    return { preview: trimmed.slice(0, lastBoundary).trim(), truncated: true, clean: true };
  }

  // No boundary fits: trim back to a whole word so we never clip mid-word.
  const words = trimmed.split(/\s+/);
  let acc = "";
  for (const word of words) {
    const next = acc ? `${acc} ${word}` : word;
    if (acc && estimateLineCount(next) > collapsedLines) break;
    acc = next;
  }
  let preview = acc.trim();
  // Last resort: a single unbreakable token longer than the whole budget. There
  // is no word boundary to honor, so hard-cap its length (the only place we cut
  // within a token); numberOfLines then bounds the rendered height.
  if (estimateLineCount(preview) > collapsedLines) {
    preview = preview.slice(0, budget).trimEnd();
  }
  return { preview, truncated: true, clean: false };
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Editorial read-more text: shows a short, cleanly-cut preview, then expands
 * inline (no navigation, no modal). Blank-line-separated paragraphs are rendered
 * with paragraph spacing for a calmer reading rhythm in both states.
 */
export function ExpandableText({
  text,
  color,
  textStyle,
  collapsedLines,
  moreLabel,
  lessLabel,
  containerStyle,
}: {
  text: string;
  color: string;
  textStyle?: StyleProp<TextStyle>;
  collapsedLines: number;
  moreLabel: string;
  lessLabel: string;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const [expanded, setExpanded] = React.useState(false);

  const { preview, truncated, clean } = React.useMemo(
    () => buildPreview(text, collapsedLines),
    [text, collapsedLines],
  );

  // Reset when the source text changes (e.g. a recycled row or navigating
  // between collections) so a reused instance never keeps stale toggle state.
  React.useEffect(() => {
    setExpanded(false);
  }, [text, collapsedLines]);

  const fullParagraphs = React.useMemo(
    () => splitParagraphs(text.trim()),
    [text],
  );
  const showingFull = expanded || !truncated;

  return (
    <View style={containerStyle}>
      {showingFull ? (
        fullParagraphs.map((p, i) => (
          <Text
            key={i}
            style={[
              textStyle,
              { color },
              i === fullParagraphs.length - 1 ? null : styles.paragraphGap,
            ]}
          >
            {p}
          </Text>
        ))
      ) : (
        // Collapsed: the computed preview already ends cleanly; numberOfLines is
        // a hard height cap for the rare case the line estimate undershoots
        // (e.g. CJK glyphs, very large fonts, long unbreakable tokens).
        <Text style={[textStyle, { color }]} numberOfLines={collapsedLines}>
          {preview}
          {clean ? "" : "…"}
        </Text>
      )}
      {truncated ? (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Text style={[styles.toggle, { color }]}>
            {expanded ? lessLabel : moreLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  paragraphGap: { marginBottom: 14 },
  toggle: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 8,
    opacity: 0.8,
  },
});
