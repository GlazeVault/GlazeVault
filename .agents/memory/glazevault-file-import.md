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

## .docx extraction
- A .docx is a ZIP. Unzip with `fflate` (`unzipSync`, pure JS / Hermes-safe), read `word/document.xml`, map `</w:p>`→newline, `<w:tab/>`→tab, `<w:br/>`→newline, strip remaining tags, decode XML entities. Good enough for prose; no styling preserved.
- **PDF is intentionally deferred** — rejected with a friendly message; needs a heavy parser to do reliably.

## Save semantics
Import only mutates local `bio`/`statement` state; nothing persists until the user taps Save (`handleSave → updateProfile`). The Replace/Append modal choice IS the overwrite confirmation — never overwrite a non-empty field silently.
