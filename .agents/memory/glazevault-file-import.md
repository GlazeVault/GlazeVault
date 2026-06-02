---
name: GlazeVault file-text import
description: How cross-platform document text extraction works in the Expo app (txt/docx import for profile fields)
---

# Importing text from files (Expo, cross-platform)

Used by the profile Bio / Artist Statement "Import from file" feature. Helper lives in `constants/importText.ts` (`pickAndExtractText()`); picker via `expo-document-picker`.

## Reading file contents cross-platform
- **Web**: `DocumentPicker` returns the underlying DOM `File` on `asset.file` (web only). Use `asset.file.text()` / `asset.file.arrayBuffer()`. Do NOT `fetch(asset.uri)` as the primary path — blob: URIs fail inside the canvas iframe (same root cause as the avatar bug). `fetch` is only a last-resort fallback.
- **Native**: `expo-file-system`'s new `File` class `implements Blob`, so `new File(uri).text()` and `.arrayBuffer()` are type-valid and work without legacy `readAsStringAsync`.

**Why:** the new vs legacy expo-file-system split and the web-only `asset.file` field are both undiscoverable from the call site; getting either wrong silently breaks one platform.

## Only `.txt` is supported on-device (PDF + docx reverted)
- The current picker accepts `text/plain` + `application/pdf` only. PDF selection throws a typed `UnsupportedFileError` ("PDF import is coming soon. Please use a .txt file for now.") which profile.tsx shows as a friendly alert; nothing is parsed on-device.
- **Why PDF was ripped out:** `unpdf` (serverless pdf.js) passed web e2e but **crashed Expo Go on Hermes at the top-level `import` with "Cannot read property 'default' of undefined"** — the worker-free build still isn't truly Hermes-safe, and the crash never reproduces on web (web has all the globals). Lesson: a web Playwright pass does NOT prove a native Hermes import is safe; an RN-incompatible parser can fail at *module load*, not just at call time. PDF will be done server-side later.
- docx (`fflate` unzip of `word/document.xml`) was also removed when narrowing to txt-only; both `unpdf` and `fflate` deps uninstalled. If docx is wanted back, fflate IS Hermes-safe and was never the crash.

## Save semantics
Import only mutates local `bio`/`statement` state; nothing persists until the user taps Save (`handleSave → updateProfile`). The Replace/Append modal choice IS the overwrite confirmation — never overwrite a non-empty field silently.
