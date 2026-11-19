# Selection and layer mask evidence

## Pixelmator Pro reference

Apple documents turning a canvas selection into a mask that hides everything outside the selection while retaining the original layer. Its bitmap-mask guide describes painting areas transparent or opaque and inverting a mask. Tintquarry implements this workflow with an independently designed interface and file format. [Selection to mask](https://support.apple.com/en-mide/guide/pixelmator-pro/d75p183x6p5k/mac) · [Bitmap masks](https://support.apple.com/guide/pixelmator-pro/add-and-edit-bitmap-masks-pix9feaf6a04/4.4/mac/26)

REA opened the vendor-published **Translucency & Vibrancy.pxd** tutorial project as a ZIP and verified its six member hashes without running Pixelmator Pro. The archive contains a metadata file, three data members, and two Quick Look previews. One data member is named for original content. [Pixelmator tutorial and project download](https://www.youtube.com/watch?v=Cwh5gga5gLk)

| Evidence | Observation |
| --- | --- |
| `ev_ac81569e25ad66294dede49c8e7b6e0849eba177334477c10bbed5858b28851a` | REA artifact inspection. Sample SHA-256 `dfa0c740da133c763d5f92202be304b617520c658a057dd673911c0b99f5d99c`. |
| `ev_d3a84353c739f25b0aeec1958d4e7fde3603f336a97acfa269cda3ad6c0e3fb8` | REA archive member view. Separate metadata and original-content entries are present. |
| Read-only header and SQLite check of the same sample | The original-content entry starts with a PNG signature. The metadata database contains eight layer rows and two occurrences each of the keys `maskType`, `maskDensity` and `maskBackgroundValue`. Two data entries have bitmap-buffer headers. The pixel contents and roles of those buffers remain unverified. |

The sample supports keeping original raster content and editable layer state separately. Tintquarry stores source and mask assets independently. Pixelmator Pro’s interactive handling, rendering order, mask arithmetic and broader PXD format remain unverified. A short recording from a user-authorized Mac showing select, mask, flip, crop and export, paired with a self-made PXD and PNG from that session, would let us check those cases directly.

## Tintquarry before and after

| REA runtime evidence | Observed result |
| --- | --- |
| `ev_f9efedee15857431755f11133ae7c4e537531eb402edcc6c1024538121c5a8e3` | Frozen v0.1.0 commit `fb6df561`, Chromium 151. REA created a transparent document, added and hid a fill, then undid the hide. All 11 actions completed. The final DOM showed the visible fill layer and contained no layer-mask panel. |
| `ev_8f1e363a2003e80d7311fa897c8bcc860b6dd88207ae5309782149ddb340b8ef` | v0.2.0, Chromium 151. REA repeated the same 11 actions, added a mask, entered the mask brush, selected Reveal, inverted the mask, disabled and re-enabled it, then checked undo and redo. All 30 actions completed. The final DOM showed the inverted mask enabled and the screenshot showed transparency where the fill had been visible. |

REA captured scripted UI states. A separate Chromium run drove brush strokes and selection drags. It checked document and layer coordinates, rectangular and elliptical coverage, antialiased edges, normal and inverted brush behavior, lower-layer isolation, independent edits to duplicated masks, transforms and crop, undo and redo, v0.1.0 reopen, v0.2.0 save and reopen, intact source PNG bytes, and decoded PNG export pixels.
