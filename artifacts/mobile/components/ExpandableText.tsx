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

// Rough column width estimate used as a web fallback: react-native-web does not
// fire onTextLayout, so we cannot measure wrapped line count there. We seed the
// "is this long enough to clamp?" decision from an estimate and let onTextLayout
// (native) correct it once measured.
const APPROX_CHARS_PER_LINE = 38;

// Estimate rendered line count without layout: count each explicit line break,
// and within each segment account for soft wrapping. Counting newlines matters
// because artist statements often use short manual line breaks, which a plain
// character-count threshold underestimates (leaving long text clamped with no
// way to expand on web).
function estimateLineCount(text: string): number {
  return text
    .split("\n")
    .reduce(
      (total, segment) =>
        total + Math.max(1, Math.ceil(segment.length / APPROX_CHARS_PER_LINE)),
      0,
    );
}

/**
 * Editorial read-more text: shows a short preview clamped to `collapsedLines`,
 * then expands inline (no navigation). When expanded and the source has
 * blank-line-separated paragraphs, they are rendered with paragraph spacing for
 * a calmer reading rhythm; otherwise it stays a single flowing block.
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
  const [clampable, setClampable] = React.useState(
    () => estimateLineCount(text) > collapsedLines,
  );

  // Reset when the source text changes (e.g. a recycled row or navigating
  // between collections) so a reused instance never keeps stale toggle state.
  React.useEffect(() => {
    setExpanded(false);
    setClampable(estimateLineCount(text) > collapsedLines);
  }, [text, collapsedLines]);

  const paragraphs = React.useMemo(
    () =>
      text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean),
    [text],
  );

  return (
    <View style={containerStyle}>
      {expanded && paragraphs.length > 1 ? (
        paragraphs.map((p, i) => (
          <Text
            key={i}
            style={[
              textStyle,
              { color },
              i < paragraphs.length - 1 ? styles.paragraphGap : null,
            ]}
          >
            {p}
          </Text>
        ))
      ) : (
        <Text
          style={[textStyle, { color }]}
          numberOfLines={expanded ? undefined : collapsedLines}
          onTextLayout={(e) => {
            const lines = e.nativeEvent?.lines;
            if (!lines) return; // web: onTextLayout gives no line data
            const over = lines.length > collapsedLines;
            setClampable((prev) => (prev === over ? prev : over));
          }}
        >
          {text}
        </Text>
      )}
      {clampable ? (
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
