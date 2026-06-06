import { Feather } from "@expo/vector-icons";
import React, { useMemo, useRef, useState } from "react";
import {
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { HeroImage, computeHeroLayout } from "@/components/HeroImage";
import { useColors } from "@/hooks/useColors";
import { useImageOrientations } from "@/hooks/useImageOrientations";

interface HeroRepositionProps {
  visible: boolean;
  uri: string;
  focalY: number;
  /** Called with the chosen focal point when the artist taps Done. */
  onDone: (focalY: number) => void;
  onCancel: () => void;
}

/**
 * A quiet, single-gesture reposition tool — drag the hero up or down to choose
 * which band shows. No filters, crop handles, or zoom; proportions are always
 * preserved. Only meaningful when the image is taller than its frame.
 */
export function HeroReposition({ visible, uri, focalY, onDone, onCancel }: HeroRepositionProps) {
  const colors = useColors();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const [draft, setDraft] = useState(focalY);
  const draftRef = useRef(focalY);
  const startFocal = useRef(focalY);

  // Reset the draft each time the tool is opened.
  React.useEffect(() => {
    if (visible) {
      setDraft(focalY);
      draftRef.current = focalY;
    }
  }, [visible, focalY]);

  const frameWidth = Math.min(winWidth - 48, 420);
  const maxHeight = Math.min(winHeight * 0.62, 560);

  const ratios = useImageOrientations([uri]);
  const ratio = (uri ? ratios[uri] : undefined) ?? 4 / 5;
  const layout = computeHeroLayout(frameWidth, ratio, maxHeight, draft);
  const overflow = Math.max(0, layout.imageHeight - layout.frameHeight);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Claim the gesture on touch-down AND on move, with capture variants, so
        // neither the child image nor the web pointer system can steal it.
        onStartShouldSetPanResponder: () => overflow > 0,
        onStartShouldSetPanResponderCapture: () => overflow > 0,
        onMoveShouldSetPanResponder: () => overflow > 0,
        onMoveShouldSetPanResponderCapture: () => overflow > 0,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          startFocal.current = draftRef.current;
        },
        onPanResponderMove: (_evt, gesture) => {
          if (overflow <= 0) return;
          // Dragging down (positive dy) reveals the TOP of the image (focal → 0).
          const next = Math.min(1, Math.max(0, startFocal.current - gesture.dy / overflow));
          draftRef.current = next;
          setDraft(next);
        },
      }),
    [overflow],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.backdrop, { backgroundColor: "rgba(28,24,20,0.82)" }]}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Reposition hero</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {overflow > 0
              ? "Drag the image up or down to choose what shows."
              : "This image already fits fully — nothing to reposition."}
          </Text>

          <View
            style={[
              styles.frame,
              { width: frameWidth, alignSelf: "center" },
              // On web, stop the browser from scrolling/selecting/drag-ghosting
              // the image so the pan gesture owns the pointer.
              overflow > 0 && Platform.OS === "web"
                ? ({ cursor: "grab", touchAction: "none", userSelect: "none" } as object)
                : null,
            ]}
            {...panResponder.panHandlers}
          >
            {/* The image is non-interactive so every pointer/touch event reaches
                the frame's PanResponder above (web <img> would otherwise capture
                it and trigger native drag-and-drop). */}
            <View pointerEvents="none">
              <HeroImage uri={uri} focalY={draft} maxHeight={maxHeight} width={frameWidth} borderRadius={4} />
            </View>
            {overflow > 0 ? (
              <View style={styles.dragHint} pointerEvents="none">
                <Feather name="move" size={16} color="#fff" />
              </View>
            ) : null}
          </View>

          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={styles.cancelBtn}>
              <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => onDone(draft)}
              style={[styles.doneBtn, { backgroundColor: colors.cobalt }]}
            >
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 16,
    padding: 22,
  },
  title: {
    fontSize: 20,
    fontFamily: "PlayfairDisplay_400Regular",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Poppins_300Light",
    lineHeight: 19,
    marginBottom: 18,
  },
  frame: {
    overflow: "hidden",
    borderRadius: 4,
  },
  dragHint: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    marginTop: 22,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelText: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
  },
  doneBtn: {
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 10,
  },
  doneText: {
    fontSize: 14,
    fontFamily: "Poppins_500Medium",
    color: "#fff",
  },
});
