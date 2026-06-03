module.exports = {
  preset: "jest-expo",
  testMatch: ["**/__tests__/**/*.test.{ts,tsx}"],
  // pnpm stores packages under node_modules/.pnpm/<name>@<ver>/node_modules/<name>,
  // so the RN/Expo allowlist must match right after the .pnpm/ segment (scoped
  // packages use "+" instead of "/", e.g. @react-native+js-polyfills).
  transformIgnorePatterns: [
    "node_modules/.pnpm/(?!(jest-)?(react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@unimodules|unimodules|sentry-expo|native-base|react-native-svg|react-native-gesture-handler|react-native-reanimated|react-native-safe-area-context|react-native-worklets|@testing-library))",
  ],
};
