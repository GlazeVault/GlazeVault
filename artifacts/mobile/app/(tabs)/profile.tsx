import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { persistPieceImage } from "@/constants/imageStorage";
import { ImportedText, pickAndExtractText, UnsupportedFileError } from "@/constants/importText";
import { getPortfolioCollectionPieces, isCollectionPublic } from "@/constants/privacy";
import { resolveImageSource } from "@/constants/seedImages";
import { useCollections } from "@/context/CollectionsContext";
import {
  HOMEPAGE_LAYOUTS,
  HomepageLayout,
  PUBLIC_SITE_DOMAIN,
  publicSiteSlug,
  useProfile,
} from "@/context/ProfileContext";
import { usePottery } from "@/context/PotteryContext";
import { useColors } from "@/hooks/useColors";
import { notice } from "@/lib/notice";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, updateProfile, updatePublicSite } = useProfile();
  const { pieces } = usePottery();
  const { collections } = useCollections();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio);
  const [statement, setStatement] = useState(profile.statement);
  const [website, setWebsite] = useState(profile.website);
  const [instagram, setInstagram] = useState(profile.instagram);
  const [contactEmail, setContactEmail] = useState(profile.publicSite.contactEmail);
  const [etsy, setEtsy] = useState(profile.publicSite.etsy);
  const [shopify, setShopify] = useState(profile.publicSite.shopify);
  const [avatarUri, setAvatarUri] = useState(profile.avatarUri ?? "");
  const [saving, setSaving] = useState(false);
  // Import-from-file flow: which field we're importing into, the extracted
  // preview awaiting a Replace/Append choice, and an in-flight guard.
  const [importTarget, setImportTarget] = useState<"bio" | "statement" | null>(null);
  const [importPreview, setImportPreview] = useState<ImportedText | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  // Prevents overlapping picker/save runs (and duplicate native file copies)
  // from rapid taps on the avatar.
  const pickingAvatar = useRef(false);

  // The Profile previews the public Portfolio, so it must match what visitors
  // see: public collections that contain at least one FEATURED piece. A public
  // collection with nothing featured is dropped, exactly like the live site.
  const featuredCollections = collections.filter(
    (c) => isCollectionPublic(c) && getPortfolioCollectionPieces(c, pieces).length > 0,
  );
  const site = profile.publicSite;

  const startEditing = () => {
    setName(profile.name);
    setBio(profile.bio);
    setStatement(profile.statement);
    setWebsite(profile.website);
    setInstagram(profile.instagram);
    setContactEmail(profile.publicSite.contactEmail);
    setEtsy(profile.publicSite.etsy);
    setShopify(profile.publicSite.shopify);
    setAvatarUri(profile.avatarUri ?? "");
    setIsEditing(true);
  };

  const cancelEditing = () => setIsEditing(false);

  const handleSave = async () => {
    setSaving(true);
    let storedAvatar = avatarUri;
    if (avatarUri) {
      try {
        storedAvatar = await persistPieceImage(avatarUri);
      } catch (e) {
        console.warn("Failed to persist avatar", e);
        setSaving(false);
        notice({ title: "Couldn’t save photo", message: "We couldn’t store that photo. Please try again.", variant: "error" });
        return;
      }
    }
    await updateProfile({
      name,
      bio,
      statement,
      website,
      instagram,
      avatarUri: storedAvatar || undefined,
    });
    await updatePublicSite({ contactEmail, etsy, shopify });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaving(false);
    setIsEditing(false);
  };

  // Immediate-save controls. updatePublicSite merges against fresh store state,
  // so rapid taps and the edit-form save never clobber each other.
  const toggleSite = async () => {
    await Haptics.selectionAsync();
    await updatePublicSite({ enabled: !site.enabled });
  };

  const selectLayout = async (layout: HomepageLayout) => {
    await Haptics.selectionAsync();
    await updatePublicSite({ homepageLayout: layout });
  };

  const publicSiteUrl = `${PUBLIC_SITE_DOMAIN}/${publicSiteSlug(profile.name)}`;

  const handleCopyLink = async () => {
    if (!site.enabled) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(publicSiteUrl);
    notice({ title: "Link copied", message: `${publicSiteUrl} is on your clipboard.`, variant: "success" });
  };

  const handleShareSite = async () => {
    if (!site.enabled) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `${profile.name ? `${profile.name} — ` : ""}${publicSiteUrl}`,
        url: `https://${publicSiteUrl}`,
        title: profile.name || "My public site",
      });
    } catch (e) {
      console.warn("Failed to share public site", e);
    }
  };

  // Tapping the avatar (in any mode) opens the picker, copies the image into
  // permanent storage, and saves it immediately so it survives reloads and shows
  // right away — independent of the text-field Save button.
  const pickAvatar = async () => {
    if (pickingAvatar.current) return;
    pickingAvatar.current = true;
    try {
      await runPickAvatar();
    } finally {
      pickingAvatar.current = false;
    }
  };

  const runPickAvatar = async () => {
    console.log("Avatar pressed");
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        notice({ title: "Permission needed", message: "Allow access to your photo library." });
        return;
      }
    }
    // On web the picker's `uri` is a blob: URL (revoked on reload) and fetching
    // it can fail inside the sandboxed preview iframe, so we ask for base64 and
    // build a permanent data: URI directly — no fetch needed.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: Platform.OS === "web",
    });
    // Avoid dumping the (huge) base64 payload; log a structural summary instead.
    console.log("Picker result:", {
      canceled: result.canceled,
      assetCount: result.assets?.length ?? 0,
      hasBase64: !!result.assets?.[0]?.base64,
      mimeType: result.assets?.[0]?.mimeType,
      uriPrefix: result.assets?.[0]?.uri?.slice(0, 16),
    });
    if (result.canceled || !result.assets?.[0]?.uri) {
      console.log("Picker canceled or returned no asset");
      return;
    }
    const asset = result.assets[0];
    const selectedUri = asset.uri;
    console.log("Selected URI:", selectedUri.slice(0, 64));

    // Turn the picked image into a permanent URI:
    //  - web   → base64 data: URI (survives reload, no blob fetch)
    //  - native → copy into documentDirectory and store a relative path
    let storedAvatar: string;
    try {
      if (Platform.OS === "web") {
        // On web we must use the picker's base64; falling back to fetching the
        // blob: URL is exactly the path that fails in the preview iframe.
        if (!asset.base64) throw new Error("Picker returned no base64 data on web");
        storedAvatar = `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`;
        console.log("Copying avatar to: web data URI, length", storedAvatar.length);
      } else {
        console.log("Copying avatar to: documentDirectory from", selectedUri.slice(0, 64));
        storedAvatar = await persistPieceImage(selectedUri);
      }
    } catch (e) {
      console.warn("Failed to copy avatar", e);
      notice({ title: "Couldn’t save photo", message: "We couldn’t store that photo. Please try again.", variant: "error" });
      return;
    }
    console.log("Avatar copied successfully:", storedAvatar.slice(0, 64));

    setAvatarUri(storedAvatar);
    try {
      console.log("Saving profile avatar");
      await updateProfile({ avatarUri: storedAvatar });
      console.log("Updated profile avatarUri:", storedAvatar.slice(0, 64));
    } catch (e) {
      console.warn("Failed to save profile avatar", e);
      notice({ title: "Couldn’t save photo", message: "Your photo was loaded but couldn’t be saved. Please try again.", variant: "error" });
    }
  };

  const handleImportPress = async (target: "bio" | "statement") => {
    if (importBusy) return;
    setImportBusy(true);
    try {
      const result = await pickAndExtractText();
      if (!result) return; // user canceled the picker
      if (!result.text.trim()) {
        notice({ title: "Nothing to import", message: "We couldn’t find any readable text in that file." });
        return;
      }
      setImportTarget(target);
      setImportPreview(result);
    } catch (e) {
      console.warn("Import from file failed", e);
      if (e instanceof UnsupportedFileError) {
        notice({ title: "PDF not supported yet", message: e.message });
      } else {
        notice({ title: "Import failed", message: e instanceof Error ? e.message : "We couldn’t read that file.", variant: "error" });
      }
    } finally {
      setImportBusy(false);
    }
  };

  const closeImport = () => {
    setImportTarget(null);
    setImportPreview(null);
  };

  const applyImport = (mode: "replace" | "append") => {
    if (!importPreview || !importTarget) return;
    const current = importTarget === "bio" ? bio : statement;
    const setter = importTarget === "bio" ? setBio : setStatement;
    const incoming = importPreview.text.trim();
    const next =
      mode === "append" && current.trim()
        ? `${current.trimEnd()}\n\n${incoming}`
        : incoming;
    setter(next);
    closeImport();
  };

  const renderImportButton = (target: "bio" | "statement") => (
    <Pressable
      onPress={() => handleImportPress(target)}
      disabled={importBusy}
      style={({ pressed }) => [
        styles.importBtn,
        { borderColor: "rgba(120,110,100,0.22)", opacity: pressed || importBusy ? 0.55 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Import from file"
      accessibilityHint="Choose a .txt file to fill this field"
    >
      {importBusy ? (
        <ActivityIndicator size="small" color={colors.mutedForeground} />
      ) : (
        <Feather name="upload" size={12} color={colors.mutedForeground} />
      )}
      <Text style={[styles.importBtnText, { color: colors.mutedForeground }]}>Import from file</Text>
    </Pressable>
  );

  const initial = (isEditing ? name : profile.name).trim().charAt(0).toUpperCase();
  // Avatar display depends only on the persisted profile, so the picked image
  // shows immediately after save and the letter fallback appears only when there
  // is genuinely no avatar — no edit-mode/local-state split to drop it.
  const displayAvatar = profile.avatarUri;
  console.log("Rendering avatarUri:", displayAvatar ? displayAvatar.slice(0, 64) : "(none)");

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 32, paddingBottom: insets.bottom + 120 },
        ]}
      >
        {/* Header row */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.cobalt }]}>GlazeVault</Text>
            <Text style={[styles.heading, { color: colors.foreground }]}>Profile</Text>
          </View>
          {isEditing ? (
            <View style={styles.editActions}>
              <Pressable onPress={cancelEditing} style={styles.cancelBtn}>
                <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={[styles.saveBtn, { backgroundColor: colors.cobalt }]}
              >
                <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save"}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={startEditing}
              style={[styles.editBtn, { borderColor: "rgba(120,110,100,0.2)" }]}
            >
              <Feather name="edit-2" size={13} color={colors.mutedForeground} />
              <Text style={[styles.editBtnText, { color: colors.mutedForeground }]}>Edit</Text>
            </Pressable>
          )}
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <Pressable onPress={pickAvatar} style={styles.avatarWrap}>
            {displayAvatar ? (
              <Image
                source={resolveImageSource(displayAvatar)}
                style={styles.avatar}
                contentFit="cover"
                transition={250}
              />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.secondary }]}>
                {initial ? (
                  <Text style={[styles.avatarInitial, { color: colors.foreground }]}>{initial}</Text>
                ) : (
                  <Feather name="user" size={28} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
                )}
              </View>
            )}
            <View style={[styles.avatarEditBadge, { backgroundColor: colors.foreground }]}>
              <Feather name="camera" size={10} color={colors.background} />
            </View>
          </Pressable>
        </View>

        {/* Name */}
        {isEditing ? (
          <TextInput
            style={[styles.nameInput, { color: colors.foreground, borderBottomColor: "rgba(120,110,100,0.2)" }]}
            value={name}
            onChangeText={setName}
            placeholder="Artist name"
            placeholderTextColor={colors.mutedForeground}
          />
        ) : (
          <Text style={[styles.name, { color: colors.foreground }]}>
            {profile.name || (
              <Text style={{ color: colors.mutedForeground, fontFamily: "Poppins_300Light", fontSize: 18 }}>
                Add your name
              </Text>
            )}
          </Text>
        )}

        {/* Bio */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Bio</Text>
          {isEditing ? (
            <>
              <TextInput
                style={[styles.bioInput, { color: colors.foreground, borderBottomColor: "rgba(120,110,100,0.2)" }]}
                value={bio}
                onChangeText={setBio}
                placeholder="A few words about your practice…"
                placeholderTextColor={colors.mutedForeground}
                multiline
                textAlignVertical="top"
              />
              {renderImportButton("bio")}
            </>
          ) : profile.bio ? (
            <Text style={[styles.bioText, { color: colors.foreground }]}>{profile.bio}</Text>
          ) : (
            <Text style={[styles.emptyField, { color: colors.mutedForeground }]}>
              Add a short bio about your ceramic practice
            </Text>
          )}
        </View>

        {/* Artist Statement */}
        <View style={[styles.statementCard, { backgroundColor: colors.secondary, borderColor: "rgba(120,110,100,0.12)" }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginBottom: 12 }]}>
            Artist Statement
          </Text>
          {isEditing ? (
            <>
              <TextInput
                style={[styles.statementInput, { color: colors.foreground }]}
                value={statement}
                onChangeText={setStatement}
                placeholder="Your artistic vision and approach…"
                placeholderTextColor={colors.mutedForeground}
                multiline
                textAlignVertical="top"
              />
              {renderImportButton("statement")}
            </>
          ) : profile.statement ? (
            <Text style={[styles.statementText, { color: colors.foreground }]}>{profile.statement}</Text>
          ) : (
            <Text style={[styles.emptyField, { color: colors.mutedForeground }]}>
              Add a statement about your artistic vision
            </Text>
          )}
        </View>

        {/* Featured Collections */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              Portfolio
            </Text>
            {featuredCollections.length > 0 && (
              <View style={[styles.countBadge, { backgroundColor: "rgba(107,127,163,0.1)" }]}>
                <Text style={[styles.countBadgeText, { color: colors.cobalt }]}>
                  {featuredCollections.length}
                </Text>
              </View>
            )}
          </View>
          {featuredCollections.length === 0 ? (
            <View style={[styles.publicEmpty, { borderColor: "rgba(120,110,100,0.12)" }]}>
              <Feather name="star" size={16} color={colors.mutedForeground} style={{ opacity: 0.35, marginBottom: 8 }} />
              <Text style={[styles.publicEmptyText, { color: colors.mutedForeground }]}>
                Nothing featured yet
              </Text>
              <Text style={[styles.publicEmptyHint, { color: colors.mutedForeground }]}>
                Feature pieces in a public collection to show them here
              </Text>
            </View>
          ) : (
            <View style={styles.featuredList}>
              {featuredCollections.map((c) => {
                const cp = getPortfolioCollectionPieces(c, pieces);
                const coverUri =
                  c.coverImageUri || cp.find((p) => p.imageUri)?.imageUri;
                return (
                  <Pressable
                    key={c.id}
                    style={({ pressed }) => [
                      styles.featuredCard,
                      {
                        backgroundColor: colors.secondary,
                        borderColor: "rgba(120,110,100,0.12)",
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                    onPress={() => router.push(`/collection/${c.id}`)}
                  >
                    <View style={[styles.featuredCover, { backgroundColor: "rgba(120,110,100,0.1)" }]}>
                      {coverUri ? (
                        <Image
                          source={resolveImageSource(coverUri)}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                          transition={200}
                        />
                      ) : (
                        <Feather name="image" size={18} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
                      )}
                    </View>
                    <View style={styles.featuredInfo}>
                      <Text style={[styles.featuredTitle, { color: colors.foreground }]} numberOfLines={1}>
                        {c.title}
                      </Text>
                      <Text style={[styles.featuredCount, { color: colors.mutedForeground }]}>
                        {cp.length} public {cp.length === 1 ? "piece" : "pieces"}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={colors.mutedForeground} style={{ opacity: 0.5 }} />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Links */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Links</Text>
          {isEditing ? (
            <View style={styles.linksEdit}>
              <View style={styles.linkEditRow}>
                <Feather name="globe" size={14} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.linkInput, { color: colors.foreground, borderBottomColor: "rgba(120,110,100,0.2)" }]}
                  value={website}
                  onChangeText={setWebsite}
                  placeholder="yourwebsite.com"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>
              <View style={styles.linkEditRow}>
                <Feather name="instagram" size={14} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.linkInput, { color: colors.foreground, borderBottomColor: "rgba(120,110,100,0.2)" }]}
                  value={instagram}
                  onChangeText={setInstagram}
                  placeholder="@yourstudio"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                />
              </View>
            </View>
          ) : (
            <View style={styles.links}>
              {profile.website ? (
                <View style={styles.linkRow}>
                  <Feather name="globe" size={13} color={colors.mutedForeground} />
                  <Text style={[styles.linkText, { color: colors.cobalt }]}>{profile.website}</Text>
                </View>
              ) : null}
              {profile.instagram ? (
                <View style={styles.linkRow}>
                  <Feather name="instagram" size={13} color={colors.mutedForeground} />
                  <Text style={[styles.linkText, { color: colors.cobalt }]}>{profile.instagram}</Text>
                </View>
              ) : null}
              {!profile.website && !profile.instagram ? (
                <Text style={[styles.emptyField, { color: colors.mutedForeground }]}>
                  Add your website and Instagram
                </Text>
              ) : null}
            </View>
          )}
        </View>

        {/* Public Site */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Public Site</Text>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: site.enabled
                    ? "rgba(107,139,122,0.12)"
                    : colors.secondary,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  { color: site.enabled ? colors.emerald : "#8A7B6C" },
                ]}
              >
                {site.enabled ? "Live" : "Off"}
              </Text>
            </View>
          </View>

          {/* On / Off toggle */}
          <Pressable
            style={[
              styles.siteToggleRow,
              {
                backgroundColor: site.enabled ? "rgba(107,139,122,0.1)" : colors.secondary,
                borderColor: site.enabled ? "rgba(107,139,122,0.3)" : "rgba(120,110,100,0.16)",
              },
            ]}
            onPress={toggleSite}
            accessibilityRole="switch"
            accessibilityState={{ checked: site.enabled }}
            accessibilityLabel="Public site"
          >
            <Feather
              name={site.enabled ? "globe" : "lock"}
              size={15}
              color={site.enabled ? colors.emerald : colors.mutedForeground}
            />
            <View style={styles.siteToggleLabels}>
              <Text
                style={[
                  styles.siteToggleTitle,
                  { color: site.enabled ? colors.emerald : colors.foreground },
                ]}
              >
                {site.enabled ? "Your site is live" : "Site is off"}
              </Text>
              <Text style={[styles.siteToggleSub, { color: colors.mutedForeground }]}>
                A gallery built from your public collections
              </Text>
            </View>
            <View
              style={[
                styles.visToggle,
                {
                  backgroundColor: site.enabled ? colors.emerald : "rgba(120,110,100,0.18)",
                },
              ]}
            >
              <View
                style={[
                  styles.visToggleThumb,
                  { transform: [{ translateX: site.enabled ? 18 : 2 }] },
                ]}
              />
            </View>
          </Pressable>

          {/* Public URL preview */}
          <View style={[styles.urlRow, { borderColor: "rgba(120,110,100,0.16)" }]}>
            <Feather name="link" size={13} color={colors.mutedForeground} />
            <Text style={[styles.urlText, { color: colors.foreground }]} numberOfLines={1}>
              {PUBLIC_SITE_DOMAIN}/{publicSiteSlug(isEditing ? name : profile.name)}
            </Text>
          </View>

          {site.enabled ? (
            <>
              {/* Portfolio hint — featuring is managed per piece (the star on
                  each piece), and only public, featured pieces surface here. */}
              <View style={[styles.siteHintRow, { borderColor: "rgba(120,110,100,0.16)" }]}>
                <Feather name="star" size={13} color={colors.cobalt} />
                <Text style={[styles.siteHintText, { color: colors.mutedForeground }]}>
                  {featuredCollections.length === 0
                    ? "Feature pieces in a public collection to add them to your portfolio."
                    : `${featuredCollections.length} ${
                        featuredCollections.length === 1 ? "collection is" : "collections are"
                      } in your portfolio. Feature pieces to curate what shows.`}
                </Text>
              </View>

              {/* Homepage layout */}
              <Text style={[styles.subLabel, { color: colors.mutedForeground, marginTop: 22 }]}>
                Homepage Layout
              </Text>
              <View style={styles.layoutWrap}>
                {HOMEPAGE_LAYOUTS.map((l) => {
                  const selected = site.homepageLayout === l.key;
                  return (
                    <Pressable
                      key={l.key}
                      onPress={() => selectLayout(l.key)}
                      style={[
                        styles.layoutCard,
                        {
                          backgroundColor: selected ? "rgba(107,127,163,0.1)" : colors.secondary,
                          borderColor: selected ? colors.cobalt : "rgba(120,110,100,0.14)",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.layoutLabel,
                          { color: selected ? colors.cobalt : colors.foreground },
                        ]}
                      >
                        {l.label}
                      </Text>
                      <Text style={[styles.layoutHint, { color: colors.mutedForeground }]}>
                        {l.hint}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Contact & commerce */}
              <Text style={[styles.subLabel, { color: colors.mutedForeground, marginTop: 22 }]}>
                Contact & Shop
              </Text>
              {isEditing ? (
                <View style={styles.linksEdit}>
                  <View style={styles.linkEditRow}>
                    <Feather name="mail" size={14} color={colors.mutedForeground} />
                    <TextInput
                      style={[styles.linkInput, { color: colors.foreground, borderBottomColor: "rgba(120,110,100,0.2)" }]}
                      value={contactEmail}
                      onChangeText={setContactEmail}
                      placeholder="hello@yourstudio.com"
                      placeholderTextColor={colors.mutedForeground}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>
                  <View style={styles.linkEditRow}>
                    <Feather name="shopping-bag" size={14} color={colors.mutedForeground} />
                    <TextInput
                      style={[styles.linkInput, { color: colors.foreground, borderBottomColor: "rgba(120,110,100,0.2)" }]}
                      value={etsy}
                      onChangeText={setEtsy}
                      placeholder="Etsy shop link"
                      placeholderTextColor={colors.mutedForeground}
                      autoCapitalize="none"
                      keyboardType="url"
                    />
                  </View>
                  <View style={styles.linkEditRow}>
                    <Feather name="shopping-cart" size={14} color={colors.mutedForeground} />
                    <TextInput
                      style={[styles.linkInput, { color: colors.foreground, borderBottomColor: "rgba(120,110,100,0.2)" }]}
                      value={shopify}
                      onChangeText={setShopify}
                      placeholder="Shopify store link"
                      placeholderTextColor={colors.mutedForeground}
                      autoCapitalize="none"
                      keyboardType="url"
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.links}>
                  {site.contactEmail ? (
                    <View style={styles.linkRow}>
                      <Feather name="mail" size={13} color={colors.mutedForeground} />
                      <Text style={[styles.linkText, { color: colors.cobalt }]}>{site.contactEmail}</Text>
                    </View>
                  ) : null}
                  {site.etsy ? (
                    <View style={styles.linkRow}>
                      <Feather name="shopping-bag" size={13} color={colors.mutedForeground} />
                      <Text style={[styles.linkText, { color: colors.cobalt }]}>{site.etsy}</Text>
                    </View>
                  ) : null}
                  {site.shopify ? (
                    <View style={styles.linkRow}>
                      <Feather name="shopping-cart" size={13} color={colors.mutedForeground} />
                      <Text style={[styles.linkText, { color: colors.cobalt }]}>{site.shopify}</Text>
                    </View>
                  ) : null}
                  {!site.contactEmail && !site.etsy && !site.shopify ? (
                    <Text style={[styles.emptyField, { color: colors.mutedForeground }]}>
                      Add a contact email and shop links
                    </Text>
                  ) : null}
                </View>
              )}

              <Text style={[styles.siteHint, { color: colors.mutedForeground }]}>
                Your name, bio, statement, website, and Instagram from above also appear on your
                site. Only collections you’ve added to your portfolio — and their photographed
                pieces — are shown.
              </Text>

              {/* Preview */}
              <Pressable
                style={[styles.previewBtn, { backgroundColor: colors.foreground }]}
                onPress={() => router.push("/public-site")}
              >
                <Feather name="external-link" size={14} color={colors.background} />
                <Text style={[styles.previewBtnText, { color: colors.background }]}>
                  Preview Public Site
                </Text>
              </Pressable>
            </>
          ) : (
            <Text style={[styles.siteHint, { color: colors.mutedForeground }]}>
              Turn on your site to feature collections, choose a layout, and share a public
              gallery of your work.
            </Text>
          )}

          {/* Share */}
          <Text style={[styles.subLabel, { color: colors.mutedForeground, marginTop: 24 }]}>
            Share
          </Text>
          <View style={styles.shareRow}>
            <Pressable
              style={[
                styles.shareBtn,
                {
                  backgroundColor: colors.secondary,
                  borderColor: "rgba(120,110,100,0.16)",
                  opacity: site.enabled ? 1 : 0.45,
                },
              ]}
              onPress={handleCopyLink}
              disabled={!site.enabled}
              accessibilityRole="button"
              accessibilityLabel="Copy public link"
            >
              <Feather name="link" size={14} color={colors.cobalt} />
              <Text style={[styles.shareBtnText, { color: colors.foreground }]}>Copy Public Link</Text>
            </Pressable>
            <Pressable
              style={[
                styles.shareBtn,
                {
                  backgroundColor: colors.secondary,
                  borderColor: "rgba(120,110,100,0.16)",
                  opacity: site.enabled ? 1 : 0.45,
                },
              ]}
              onPress={handleShareSite}
              disabled={!site.enabled}
              accessibilityRole="button"
              accessibilityLabel="Share public site"
            >
              <Feather name="share-2" size={14} color={colors.emerald} />
              <Text style={[styles.shareBtnText, { color: colors.foreground }]}>Share Public Site</Text>
            </Pressable>
          </View>
          {!site.enabled ? (
            <Text style={[styles.shareHelper, { color: colors.mutedForeground }]}>
              Turn on your public site before sharing.
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <Modal
        visible={!!importPreview}
        transparent
        animationType="fade"
        onRequestClose={closeImport}
      >
        <TouchableWithoutFeedback onPress={closeImport}>
          <View style={styles.importOverlay}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.importSheet,
                  {
                    backgroundColor: colors.background,
                    paddingBottom: Math.max(insets.bottom, 24),
                  },
                ]}
              >
                <View style={[styles.importHandle, { backgroundColor: "rgba(120,110,100,0.2)" }]} />
                <Text style={[styles.importEyebrow, { color: colors.cobalt }]}>
                  Import to {importTarget === "statement" ? "Artist Statement" : "Bio"}
                </Text>
                <Text style={[styles.importTitle, { color: colors.foreground }]} numberOfLines={1}>
                  {importPreview?.fileName}
                </Text>
                <View style={[styles.importDivider, { backgroundColor: colors.border }]} />

                <ScrollView
                  style={[styles.importPreviewBox, { borderColor: "rgba(120,110,100,0.14)", backgroundColor: colors.secondary }]}
                  contentContainerStyle={{ padding: 16 }}
                >
                  <Text style={[styles.importPreviewText, { color: colors.foreground }]}>
                    {importPreview?.text}
                  </Text>
                </ScrollView>
                <Text style={[styles.importMeta, { color: colors.mutedForeground }]}>
                  {importPreview ? `${importPreview.text.length.toLocaleString()} characters` : ""}
                </Text>

                <View style={styles.importActions}>
                  <Pressable
                    onPress={closeImport}
                    style={({ pressed }) => [styles.importCancel, { opacity: pressed ? 0.6 : 1 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel import"
                  >
                    <Text style={[styles.importCancelText, { color: colors.mutedForeground }]}>Cancel</Text>
                  </Pressable>
                  <View style={styles.importPrimaryRow}>
                    <Pressable
                      onPress={() => applyImport("append")}
                      style={({ pressed }) => [
                        styles.importGhost,
                        { borderColor: "rgba(120,110,100,0.28)", opacity: pressed ? 0.6 : 1 },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Append imported text"
                    >
                      <Text style={[styles.importGhostText, { color: colors.foreground }]}>Append</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => applyImport("replace")}
                      style={({ pressed }) => [
                        styles.importSolid,
                        { backgroundColor: colors.foreground, opacity: pressed ? 0.85 : 1 },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Replace with imported text"
                    >
                      <Text style={[styles.importSolidText, { color: colors.background }]}>Replace</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 28 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  heading: {
    fontSize: 38,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.5,
    lineHeight: 46,
  },
  editActions: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  cancelBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  cancelText: { fontSize: 13, fontFamily: "Poppins_400Regular" },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  saveBtnText: { fontSize: 13, fontFamily: "Poppins_500Medium", color: "#FFFFFF" },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 0.75,
    marginBottom: 4,
  },
  editBtnText: { fontSize: 12, fontFamily: "Poppins_400Regular" },
  divider: { height: 1, width: 40, marginBottom: 28 },
  avatarSection: { alignItems: "center", marginBottom: 20 },
  avatarWrap: { position: "relative" },
  avatar: { width: 84, height: 84, borderRadius: 42 },
  avatarPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 32,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0,
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 26,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.3,
    lineHeight: 34,
    textAlign: "center",
    marginBottom: 24,
  },
  nameInput: {
    fontSize: 24,
    fontFamily: "PlayfairDisplay_400Regular",
    textAlign: "center",
    paddingVertical: 8,
    borderBottomWidth: 0.75,
    marginBottom: 24,
    letterSpacing: 0.3,
  },
  section: { marginTop: 28 },
  sectionLabel: {
    fontSize: 9,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  bioText: { fontSize: 14, fontFamily: "Poppins_300Light", lineHeight: 22 },
  bioInput: {
    fontSize: 14,
    fontFamily: "Poppins_300Light",
    lineHeight: 22,
    paddingVertical: 6,
    borderBottomWidth: 0.75,
    minHeight: 64,
  },
  statementCard: {
    marginTop: 28,
    padding: 20,
    borderRadius: 14,
    borderWidth: 0.75,
  },
  statementText: {
    fontSize: 16,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    lineHeight: 26,
    letterSpacing: 0.2,
  },
  statementInput: {
    fontSize: 15,
    fontFamily: "Poppins_300Light",
    lineHeight: 24,
    minHeight: 80,
  },
  emptyField: { fontSize: 13, fontFamily: "Poppins_300Light", fontStyle: "italic", lineHeight: 20 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 10,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 0.5,
  },
  publicEmpty: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 0.75,
    alignItems: "center",
    gap: 4,
  },
  publicEmptyText: { fontSize: 13, fontFamily: "Poppins_400Regular", lineHeight: 20 },
  publicEmptyHint: { fontSize: 12, fontFamily: "Poppins_300Light", lineHeight: 18, textAlign: "center", opacity: 0.8 },
  links: { gap: 12 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  linkText: { fontSize: 14, fontFamily: "Poppins_300Light" },
  linksEdit: { gap: 16 },
  linkEditRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  linkInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Poppins_300Light",
    paddingVertical: 6,
    borderBottomWidth: 0.75,
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusPillText: {
    fontSize: 10,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 0.5,
  },
  siteToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 0.75,
  },
  siteToggleLabels: { flex: 1, gap: 2 },
  siteToggleTitle: { fontSize: 14, fontFamily: "Poppins_500Medium", letterSpacing: 0.2 },
  siteToggleSub: { fontSize: 11, fontFamily: "Poppins_300Light", letterSpacing: 0.2 },
  visToggle: {
    width: 42,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
  },
  visToggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#FFFFFF" },
  urlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 0.75,
    marginTop: 12,
  },
  urlText: { flex: 1, fontSize: 13, fontFamily: "Poppins_400Regular", letterSpacing: 0.2 },
  subLabel: {
    fontSize: 9,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginTop: 24,
    marginBottom: 12,
  },
  featuredList: { gap: 10 },
  featuredCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 10,
    borderRadius: 14,
    borderWidth: 0.75,
  },
  featuredCover: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  featuredInfo: { flex: 1, gap: 3 },
  featuredTitle: {
    fontSize: 16,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.2,
  },
  featuredCount: { fontSize: 12, fontFamily: "Poppins_300Light", letterSpacing: 0.2 },
  siteHintRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 0.75,
  },
  siteHintText: { flex: 1, fontSize: 12, fontFamily: "Poppins_300Light", lineHeight: 19 },
  layoutWrap: { gap: 8 },
  layoutCard: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 0.75,
  },
  layoutLabel: { fontSize: 14, fontFamily: "Poppins_500Medium", letterSpacing: 0.2 },
  layoutHint: { fontSize: 11, fontFamily: "Poppins_300Light", letterSpacing: 0.2, marginTop: 2 },
  siteHint: {
    fontSize: 12,
    fontFamily: "Poppins_300Light",
    lineHeight: 19,
    marginTop: 20,
  },
  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 26,
    marginTop: 20,
  },
  previewBtnText: { fontSize: 14, fontFamily: "Poppins_500Medium", letterSpacing: 0.3 },
  shareRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  shareBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 0.75,
  },
  shareBtnText: { fontSize: 12, fontFamily: "Poppins_500Medium", letterSpacing: 0.2 },
  shareHelper: {
    fontSize: 12,
    fontFamily: "Poppins_300Light",
    letterSpacing: 0.2,
    marginTop: 10,
  },
  importBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
    marginTop: 12,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 18,
    borderWidth: 0.75,
  },
  importBtnText: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  importOverlay: { flex: 1, backgroundColor: "rgba(40,36,32,0.4)", justifyContent: "flex-end" },
  importSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  importHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 22 },
  importEyebrow: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  importTitle: {
    fontSize: 22,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.3,
    marginBottom: 14,
  },
  importDivider: { height: 1, width: 40, marginBottom: 18 },
  importPreviewBox: {
    maxHeight: 240,
    borderRadius: 16,
    borderWidth: 0.75,
  },
  importPreviewText: { fontSize: 14, fontFamily: "Poppins_300Light", lineHeight: 22 },
  importMeta: {
    fontSize: 11,
    fontFamily: "Poppins_300Light",
    letterSpacing: 0.3,
    marginTop: 10,
    marginBottom: 18,
  },
  importActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  importCancel: { paddingVertical: 12, paddingHorizontal: 8 },
  importCancelText: { fontSize: 13, fontFamily: "Poppins_500Medium", letterSpacing: 0.3 },
  importPrimaryRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  importGhost: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 0.75,
  },
  importGhostText: { fontSize: 13, fontFamily: "Poppins_500Medium", letterSpacing: 0.3 },
  importSolid: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 24,
  },
  importSolidText: { fontSize: 13, fontFamily: "Poppins_500Medium", letterSpacing: 0.3 },
});
