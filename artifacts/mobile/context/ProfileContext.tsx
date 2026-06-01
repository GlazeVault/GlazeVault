import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface ArtistProfile {
  name: string;
  bio: string;
  statement: string;
  website: string;
  instagram: string;
  avatarUri?: string;
}

const DEFAULT_PROFILE: ArtistProfile = {
  name: "",
  bio: "",
  statement: "",
  website: "",
  instagram: "",
};

interface ProfileContextType {
  profile: ArtistProfile;
  updateProfile: (updates: Partial<ArtistProfile>) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);
const STORAGE_KEY = "@glazevault_profile_v1";

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<ArtistProfile>(DEFAULT_PROFILE);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((data) => {
      if (data) setProfile(JSON.parse(data));
    });
  }, []);

  const updateProfile = useCallback(
    async (updates: Partial<ArtistProfile>) => {
      const updated = { ...profile, ...updates };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setProfile(updated);
    },
    [profile]
  );

  return (
    <ProfileContext.Provider value={{ profile, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
