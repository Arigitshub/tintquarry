# Workflow notes and roadmap

Tintquarry is an independent implementation of image-editing workflows documented for Pixelmator Pro. The research used Apple’s public product overview, public Mac user guide, official interface screenshots surfaced in image search, and published descriptions of Pixelmator’s beginner videos. YouTube playback and transcripts were unavailable in this review. Pixelmator Pro runtime behavior, source code, proprietary project files, rendering algorithms and numerical settings were outside the available evidence. The mapping describes entry points and user outcomes documented by Apple. Runtime equivalence remains untested.

## v0.1 workflow mapping

| Documented workflow | Tintquarry v0.1 |
| --- | --- |
| Create or open a document, then add and arrange layers | New transparent canvas, still-image opening, multi-image import and drag and drop, color and paint layers, select, rename, reorder, duplicate, visibility and delete |
| Position, rotate, scale and flip individual layers | Drag the selected layer, or change its position, uniform scale, rotation and orientation with the inspector |
| Adjust color and compare the result | Per-layer brightness, contrast, saturation and hue, an RGB composite histogram, adjustable opacity, eight blend modes and an adjustment bypass for preview |
| Paint, erase and crop | Round raster brush and paint-layer eraser, adjustable size and brush color, and undoable rectangular document crop |
| Save an editable document or export a composite | Versioned, self-contained `.tq` files and full-size transparent PNG export |

## Planned work

| Area | Next capabilities and verification |
| --- | --- |
| Selections and masks | Rectangle, ellipse, lasso and feathering, then bitmap masks and clipping groups. Check intersections, fractional alpha and save/reopen behavior. |
| Painting and retouching | Pressure-sensitive brushes, hardness, brush presets, gradients, color sampling, healing and clone tools. Test pointer devices and large strokes. |
| Vector and type | Editable text, shapes and path layers, then Bézier tools, typography, alignment, and guides. Test rendering at multiple scales and account for fonts during export. |
| Advanced photo editing | Exposure and white balance with a color-managed pipeline, levels, curves, selective color, effects, presets, improved histograms and adjustment layers. Verify against known test charts and documented color spaces. |
| RAW and interoperability | Native RAW decoding that preserves original sensor files, richer exports, PSD and SVG interoperability where documented and supportable. Test legitimate reference files, color profiles and metadata. |
| ML features | Optional local segmentation, background removal, upscaling and denoising, with a separate review for model licenses, device performance and output quality. |
| Production workflows | Layer groups, templates, batch editing, richer crop and resize, video layers, touch and pen workflows, and reliability across browser engines. |

## Reference material

- Product overview and screenshots for layering, effects, masks, RAW, video, vectors and intelligent tools. [Apple Pixelmator Pro](https://www.apple.com/pixelmator-pro/)
- Mac guide with workflows for document creation, layers, selections, adjustments, painting, vector paths, text, masks, crop, color management and export. [Pixelmator Pro User Guide](https://support.apple.com/guide/pixelmator-pro/welcome/mac)
- Interface screenshots and explanations of the canvas, layers, tools and status controls. [Pixelmator Pro for Mac interface](https://support.apple.com/en-mide/guide/pixelmator-pro/pix96e754af4/mac)
- Layer order, visibility, groups and compositing. [Intro to layers](https://support.apple.com/en-lamr/guide/pixelmator-pro/pixea4964220/mac)
- Replacement-color example with a visible before-and-after view and histogram. [Remove and replace colors](https://support.apple.com/guide/pixelmator-pro/remove-replace-colors-image-video-pixc649f3ead/mac)
- RAW layers preserve original sensor data and can be reprocessed. [Work with RAW files](https://support.apple.com/guide/pixelmator-pro/work-with-raw-files-pix260d78823/mac)
- Beginner series entry point covering the interface and linking lessons about documents, layers, masks, tools and export. [Interface walkthrough on YouTube](https://www.youtube.com/watch?v=0jIPLgUS0IA)
- Adding and combining layers in a composition. [About Layers on YouTube](https://www.youtube.com/watch?v=wd1cVpqu4k0)
- Saving a working document and exporting it for sharing. [Saving & Exporting Documents on YouTube](https://www.youtube.com/watch?v=8cbVojq75rs)
