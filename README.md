# Tintquarry

Tintquarry is a local-first raster editor for layering images, adjusting color, painting and exporting a full-resolution composite. The editor runs in your browser, and the local server serves only the app and the bundled sample. Opening, editing and exporting images happen on your device.

## Run the editor

With Node.js 20 or later, run this from the repository directory.

```sh
npm start
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). Use a current Chromium-based browser for the verified workflow. There are no npm dependencies or build steps. The static files can also run from an HTTPS static host.

## Edit an image

1. Start with the **Salt and Sky** sample, use **New** for a transparent canvas, or use **Open** to start with an image. Drop photos onto the canvas or use **Layers → Add layer → Import images** to add them to a composition.
2. Pick a layer and use Move, the Transform controls, or the compositing controls to position it and set opacity or blend mode. The Layers panel includes visibility, reordering, duplicate, rename and delete.
3. Adjust brightness, contrast, saturation or hue. **Before** bypasses these adjustments in the preview. **Reset color** resets the selected layer. Brush adds a paint layer when needed, and Eraser works on an existing painted layer.
4. Choose **Select area**, draw a rectangle or ellipse, and choose **Mask selection** to keep the area inside. To start from a fully visible layer, choose **Add mask**. Use **Paint mask** to hide or reveal pixels. Disable a mask to show the full layer temporarily, invert it to swap hidden and visible areas, or remove it.
5. Define a crop by dragging and using **Apply crop**. Pan and zoom change the view. Undo and redo cover crop, paint, masks, layer and adjustment edits.
6. Use **Save project** to download an editable `.tq` file containing the layers, masks and source raster assets. Reopen it with **Open**. **Export PNG** downloads the edited, visible composite with transparency, regardless of zoom or the Before preview.

| Shortcut | Action |
| --- | --- |
| V / B / E / M / C / H | Move / Brush / Eraser / Select area / Crop / Pan |
| + / − / 0 | Zoom in / out / fit |
| Ctrl or Cmd + Z | Undo |
| Ctrl or Cmd + Shift + Z | Redo |
| Ctrl or Cmd + S / O | Save project / open |

Canvas and layer dimensions range from 1 to 4,096 pixels per side. Projects support up to 64 layers, up to 48 million unique decoded raster pixels and a 64 MiB editable project file. Image imports accept PNG, JPEG, WebP, AVIF, GIF and BMP as supported by the browser. Animated images import as still images. Undo is held in memory and keeps up to 40 edits, subject to its raster memory budget. The browser session holds unsaved changes. Download a project to resume later.

Each layer supports one bitmap mask. The mask follows the layer’s transform and keeps its position when the document is cropped. Tintquarry opens projects saved by v0.1.0. Projects containing masks use version 2 of `.tq` and require v0.2.0 or later.

Run `npm run check` to check JavaScript syntax. See the [workflow notes and roadmap](ROADMAP.md) for the remaining capabilities and the [REA evidence ledger](EVIDENCE.md) for the mask workflow investigation.

The software is distributed under the [MIT License](LICENSE). The bundled [sample and its provenance](assets/README.md) are included with the project.
