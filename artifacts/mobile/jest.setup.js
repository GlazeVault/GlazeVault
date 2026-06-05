// AsyncStorage ships a plain in-memory jest mock. Wiring it here (the officially
// recommended integration) lets any context that persists to AsyncStorage —
// e.g. SavedContext — be imported in render tests without hitting the native
// module, which is null under jest-expo.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
