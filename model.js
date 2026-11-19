export const MAX_SIDE = 4096;
export const MAX_LAYERS = 64;
export const MAX_PROJECT_BYTES = 64 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 24 * 1024 * 1024;
export const MAX_LIVE_PIXELS = 48_000_000;
export const MAX_HISTORY_PIXELS = 72_000_000;

export const adjustments = [
  { key: 'brightness', label: 'Brightness', min: -100, max: 100 },
  { key: 'contrast', label: 'Contrast', min: -100, max: 100 },
  { key: 'saturation', label: 'Saturation', min: -100, max: 150 },
  { key: 'hue', label: 'Hue', min: -180, max: 180, unit: '°' },
];

export const modes = {
  'source-over': 'Normal',
  multiply: 'Multiply',
  screen: 'Screen',
  overlay: 'Overlay',
  darken: 'Darken',
  lighten: 'Lighten',
  'soft-light': 'Soft light',
  difference: 'Difference',
};

const mimeFromExtension = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  avif: 'image/avif', gif: 'image/gif', bmp: 'image/bmp',
};
const allowedURL = /^data:image\/(png|jpeg|webp|avif|gif|bmp);base64,[A-Za-z0-9+/]+={0,2}$/;
const hexColor = /^#[0-9a-f]{6}$/i;

export const newId = () => crypto.randomUUID();
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const blankAdjustments = () => Object.fromEntries(adjustments.map(({ key }) => [key, 0]));
export const hasColor = layer => Object.values(layer.adjustments).some(value => value !== 0);
export const activeLayer = doc => doc.layers.find(layer => layer.id === doc.selected);

export function makeDocument(title, width, height) {
  return { title, width, height, layers: [], selected: null };
}

export function makeLayer(type, name, width, height, fields = {}) {
  return {
    id: newId(), type, name, width, height, x: 0, y: 0, scale: 100, rotation: 0,
    flipX: false, flipY: false, visible: true, opacity: 100, blend: 'source-over',
    adjustments: blankAdjustments(), ...fields,
  };
}

export function insertLayer(doc, layer) {
  if (doc.layers.length >= MAX_LAYERS) throw new Error('This project already has 64 layers.');
  const selected = doc.layers.findIndex(item => item.id === doc.selected);
  doc.layers.splice(selected < 0 ? doc.layers.length : selected + 1, 0, layer);
  doc.selected = layer.id;
}

export function imageCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function layerMatrix(layer) {
  const { width, height, x, y, rotation, scale, flipX, flipY } = layer;
  return new DOMMatrix()
    .translate(x + width / 2, y + height / 2)
    .rotate(rotation)
    .scale((flipX ? -1 : 1) * scale / 100, (flipY ? -1 : 1) * scale / 100)
    .translate(-width / 2, -height / 2);
}

export function drawComposite(canvas, doc, assets, { bypass = false, livePaint } = {}) {
  if (canvas.width !== doc.width) canvas.width = doc.width;
  if (canvas.height !== doc.height) canvas.height = doc.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';

  for (const layer of doc.layers) {
    if (!layer.visible || layer.opacity === 0) continue;
    ctx.save();
    ctx.globalAlpha = layer.opacity / 100;
    ctx.globalCompositeOperation = layer.blend;
    if (!bypass && hasColor(layer)) {
      const { brightness, contrast, saturation, hue } = layer.adjustments;
      ctx.filter = `brightness(${1 + brightness / 100}) contrast(${1 + contrast / 100}) saturate(${1 + saturation / 100}) hue-rotate(${hue}deg)`;
    }
    ctx.setTransform(layerMatrix(layer));
    if (layer.type === 'fill') {
      ctx.fillStyle = layer.color;
      ctx.fillRect(0, 0, layer.width, layer.height);
    } else {
      const image = livePaint?.id === layer.id ? livePaint.image : assets.get(layer.asset)?.image;
      if (image) ctx.drawImage(image, 0, 0, layer.width, layer.height);
    }
    ctx.restore();
  }
}

export function fileDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result), { once: true });
    reader.addEventListener('error', () => reject(new Error('Could not read the file.')), { once: true });
    reader.readAsDataURL(file);
  });
}

function validateDimensions(width, height) {
  if (![width, height].every(value => Number.isInteger(value) && value >= 1 && value <= MAX_SIDE)) {
    throw new Error('Image and layer dimensions must be from 1 to 4096 pixels.');
  }
}

export async function readRaster(file) {
  const mime = mimeFromExtension[file.name.split('.').at(-1).toLowerCase()];
  if (!mime) throw new Error('Choose a PNG, JPEG, WebP, AVIF, GIF, or BMP image.');
  if (!file.size || file.size > MAX_IMAGE_BYTES) throw new Error('Image files must be between 1 byte and 24 MiB.');
  return await decodeRaster(await fileDataURL(file.slice(0, file.size, mime)));
}

async function decodeRaster(url) {
  if (typeof url !== 'string' || !allowedURL.test(url)) throw new Error('Invalid raster asset.');
  const blob = await (await fetch(url)).blob();
  let image;
  try {
    image = await createImageBitmap(blob);
  } catch {
    throw new Error('This browser could not decode the image.');
  }
  try {
    validateDimensions(image.width, image.height);
  } catch (error) {
    image.close();
    throw error;
  }
  return { url, image, width: image.width, height: image.height };
}

export function canvasAsset(canvas) {
  return { url: canvas.toDataURL('image/png'), image: canvas, width: canvas.width, height: canvas.height };
}

export function usedAssetIDs(documents) {
  return new Set(documents.flatMap(doc => doc.layers.map(layer => layer.asset).filter(Boolean)));
}

export function assetPixels(ids, assets) {
  let total = 0;
  for (const id of ids) {
    const asset = assets.get(id);
    if (asset) total += asset.width * asset.height;
  }
  return total;
}

export function saveProject(doc, assets) {
  const images = {};
  let size = 0;
  for (const id of usedAssetIDs([doc])) {
    const url = assets.get(id).url;
    size += url.length;
    if (size > MAX_PROJECT_BYTES) throw new Error('The editable project exceeds 64 MiB.');
    images[id] = url;
  }
  const blob = new Blob([JSON.stringify({ format: 'tintquarry', version: 1, document: doc, images })], {
    type: 'application/json',
  });
  if (blob.size > MAX_PROJECT_BYTES) throw new Error('The editable project exceeds 64 MiB.');
  return blob;
}

function validName(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 100;
}

function validId(value) {
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
}

function inRange(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function readLayer(layer) {
  if (!layer || !validId(layer.id) || !validName(layer.name)) throw new Error('Invalid layer metadata.');
  validateDimensions(layer.width, layer.height);
  const { id, type, name, width, height, visible, opacity, blend, x, y, scale, rotation, flipX, flipY } = layer;
  if (!['photo', 'paint', 'fill'].includes(type) || ![visible, flipX, flipY].every(value => typeof value === 'boolean') ||
      !Object.hasOwn(modes, blend) || !inRange(opacity, 0, 100) || !inRange(x, -1e6, 1e6) ||
      !inRange(y, -1e6, 1e6) || !inRange(scale, 5, 800) || !inRange(rotation, -360, 360)) {
    throw new Error('Invalid layer settings.');
  }
  const colorSettings = {};
  for (const { key, min, max } of adjustments) {
    const value = layer.adjustments?.[key];
    if (!inRange(value, min, max)) throw new Error('Invalid color adjustment.');
    colorSettings[key] = value;
  }
  const result = { id, type, name, width, height, visible, opacity, blend, x, y, scale, rotation, flipX, flipY, adjustments: colorSettings };
  if (type === 'fill') {
    if (typeof layer.color !== 'string' || !hexColor.test(layer.color)) throw new Error('Invalid fill color.');
    result.color = layer.color;
  } else if (type === 'photo' || layer.asset != null) {
    if (!validId(layer.asset)) throw new Error('Invalid raster asset reference.');
    result.asset = layer.asset;
  }
  return result;
}

export async function openProject(file) {
  if (!file.size || file.size > MAX_PROJECT_BYTES) throw new Error('Project files must be between 1 byte and 64 MiB.');
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('Could not read the project as JSON.');
  }
  const source = data?.document;
  if (data?.format !== 'tintquarry' || data.version !== 1 || !source || !validName(source.title) ||
      !Array.isArray(source.layers) || source.layers.length > MAX_LAYERS || !data.images || typeof data.images !== 'object') {
    throw new Error('This is not a supported Tintquarry project.');
  }
  const { title, width, height } = source;
  validateDimensions(width, height);
  const layers = source.layers.map(readLayer);
  const ids = new Set(layers.map(layer => layer.id));
  if (ids.size !== layers.length) throw new Error('The project contains duplicate layer IDs.');
  const doc = { title, width, height, layers, selected: ids.has(source.selected) ? source.selected : layers.at(-1)?.id ?? null };
  const assets = new Map();
  let total = 0;
  try {
    for (const id of usedAssetIDs([doc])) {
      const asset = await decodeRaster(data.images[id]);
      assets.set(id, asset);
      total += asset.width * asset.height;
      if (total > MAX_LIVE_PIXELS) throw new Error('The project exceeds the raster memory limit.');
    }
    for (const layer of layers) {
      if (!layer.asset) continue;
      const asset = assets.get(layer.asset);
      if (asset.width !== layer.width || asset.height !== layer.height) throw new Error('A layer has mismatched raster dimensions.');
    }
  } catch (error) {
    assets.forEach(asset => asset.image.close());
    throw error;
  }
  return { doc, assets };
}
