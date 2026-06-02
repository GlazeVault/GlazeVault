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

## .pdf extraction (Expo Go / Hermes, no native modules, no Worker)
- Use **`unpdf`** (`getDocumentProxy` + `extractText(pdf,{mergePages:true})`) — its serverless pdf.js build is worker-free and canvas-free, so it runs on Hermes. Plain `pdfjs-dist` needs Worker + canvas setup that doesn't work in Expo Go.
- unpdf only stubs `DOMMatrix`. You must polyfill the rest yourself at module load: **`Promise.withResolvers`** and **`structuredClone`** (a real recursive clone handling typed arrays/DataView/ArrayBuffer/Date/RegExp/Map/Set/cycles — NOT a JSON clone, which corrupts typed arrays). Guard each with `typeof … !== "function"` so they're no-ops on web.
- Lazy-load pdf.js (~1.6MB) on first use: `definePDFJSModule(() => import("unpdf/pdfjs"))`, cache the promise, and **clear the cache on rejection** so a transient init failure can retry.
- Any failure OR an empty text layer (scanned/image-only PDF) → throw one friendly `Error("Unable to read this PDF.")`.
- **Why:** the whole PDF path is dictated by Expo Go = pure JS only; choosing the wrong lib or skipping the Hermes polyfills produces a runtime crash that never appears on web (web has all these globals).

**Verified:** web e2e (Playwright upload of a real PDF) passes; native iOS/Hermes not directly testable here — the polyfills are the known risk surface if a new global (e.g. `ReadableStream`/`atob`) turns out to be needed.

## Save semantics
Import only mutates local `bio`/`statement` state; nothing persists until the user taps Save (`handleSave → updateProfile`). The Replace/Append modal choice IS the overwrite confirmation — never overwrite a non-empty field silently.
