import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { isCollectionPublic, isPubliclyVisiblePiece } from "@/constants/privacy";
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

  const publicPieces = pieces.filter((p) => isPubliclyVisiblePiece(p, collections));
  const publicCollections = collections.filter(isCollectionPublic);
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
    await updateProfile({
      name,
      bio,
      statement,
      website,
      instagram,
      avatarUri: avatarUri || undefined,
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

  const toggleFeatured = async (collectionId: string) => {
    await Haptics.selectionAsync();
    const current = site.featuredCollectionIds;
    const next = current.includes(collectionId)
      ? current.filter((cid) => cid !== collectionId)
      : [...current, collectionId];
    await updatePublicSite({ featuredCollectionIds: next });
  };

  const selectLayout = async (layout: HomepageLayout) => {
    await Haptics.selectionAsync();
    await updatePublicSite({ homepageLayout: layout });
  };

  const pickAvatar = async () => {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
  };

  const initial = (isEditing ? name : profile.name).trim().charAt(0).toUpperCase();

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
          <Pressable onPress={isEditing ? pickAvatar : undefined} style={styles.avatarWrap}>
            {(isEditing ? avatarUri : profile.avatarUri) ? (
              <Image
                source={{ uri: isEditing ? avatarUri : profile.avatarUri }}
                style={styles.avatar}
                contentFit="cover"
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
            {isEditing && (
              <View style={[styles.avatarEditBadge, { backgroundColor: colors.foreground }]}>
                <Feather name="camera" size={10} color={colors.background} />
              </View>
            )}
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
            <TextInput
              style={[styles.bioInput, { color: colors.foreground, borderBottomColor: "rgba(120,110,100,0.2)" }]}
              value={bio}
              onChangeText={setBio}
              placeholder="A few words about your practice…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
            />
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
            <TextInput
              style={[styles.statementInput, { color: colors.foreground }]}
              value={statement}
              onChangeText={setStatement}
              placeholder="Your artistic vision and approach…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
            />
          ) : profile.statement ? (
            <Text style={[styles.statementText, { color: colors.foreground }]}>{profile.statement}</Text>
          ) : (
            <Text style={[styles.emptyField, { color: colors.mutedForeground }]}>
              Add a statement about your artistic vision
            </Text>
          )}
        </View>

        {/* Public Works */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              Public Works
            </Text>
            {publicPieces.length > 0 && (
              <View style={[styles.countBadge, { backgroundColor: "rgba(107,127,163,0.1)" }]}>
                <Text style={[styles.countBadgeText, { color: colors.cobalt }]}>
                  {publicPieces.length}
                </Text>
              </View>
            )}
          </View>
          {publicPieces.length === 0 ? (
            <View style={[styles.publicEmpty, { borderColor: "rgba(120,110,100,0.12)" }]}>
              <Feather name="eye" size={16} color={colors.mutedForeground} style={{ opacity: 0.35, marginBottom: 8 }} />
              <Text style={[styles.publicEmptyText, { color: colors.mutedForeground }]}>
                No public pieces yet
              </Text>
              <Text style={[styles.publicEmptyHint, { color: colors.mutedForeground }]}>
                Open any piece and set its visibility to Public
              </Text>
            </View>
          ) : (
            <View style={styles.publicGrid}>
              {publicPieces.map((piece) => (
                <Pressable
                  key={piece.id}
                  style={({ pressed }) => [
                    styles.publicThumb,
                    { backgroundColor: colors.secondary, opacity: pressed ? 0.85 : 1 },
                  ]}
                  onPress={() => router.push(`/piece/${piece.id}?public=1`)}
                >
                  <Image
                    source={resolveImageSource(piece.imageUri)}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={200}
                  />
                  <View style={styles.thumbOverlay}>
                    <Text style={styles.thumbTitle} numberOfLines={1}>{piece.title}</Text>
                  </View>
                </Pressable>
              ))}
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
              {/* Featured collections */}
              <Text style={[styles.subLabel, { color: colors.mutedForeground }]}>
                Featured Collections
              </Text>
              {publicCollections.length === 0 ? (
                <Text style={[styles.emptyField, { color: colors.mutedForeground }]}>
                  Make a collection public to feature it on your site
                </Text>
              ) : (
                <View style={styles.chipWrap}>
                  {publicCollections.map((c) => {
                    const selected = site.featuredCollectionIds.includes(c.id);
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => toggleFeatured(c.id)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: selected ? colors.cobalt : colors.secondary,
                            borderColor: selected ? colors.cobalt : "rgba(120,110,100,0.16)",
                          },
                        ]}
                      >
                        {selected && <Feather name="check" size={11} color="#FFFFFF" />}
                        <Text
                          style={[
                            styles.chipText,
                            { color: selected ? "#FFFFFF" : colors.foreground },
                          ]}
                          numberOfLines={1}
                        >
                          {c.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

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
                site. Only public collections, their public pieces, and the fields you allow are
                shown.
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
        </View>
      </ScrollView>
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
  publicGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  publicThumb: {
    width: "31.5%",
    aspectRatio: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  thumbOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(45,45,42,0.48)",
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  thumbTitle: {
    fontSize: 9,
    fontFamily: "Poppins_400Regular",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
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
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 0.75,
    maxWidth: "100%",
  },
  chipText: { fontSize: 12, fontFamily: "Poppins_400Regular", letterSpacing: 0.2, flexShrink: 1 },
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
});
