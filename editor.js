import {
  MAX_LIVE_PIXELS, MAX_HISTORY_PIXELS, adjustments, modes, newId, clamp, blankAdjustments,
  activeLayer, makeDocument, makeLayer, insertLayer, imageCanvas, layerMatrix, drawComposite,
  readRaster, canvasAsset, usedAssetIDs, assetPixels, saveProject, openProject,
} from './model.js';
import { setIcon } from './icons.js';

const $ = id => document.getElementById(id);
const canvas = $('canvas');
const stage = $('stage');
const artboard = $('artboard');
const histSample = imageCanvas(192, 128);
const samplePath = './assets/salt-and-sky.jpg';
const historyLimit = 40;

let doc = makeDocument('Untitled', 1200, 800);
let assets = new Map();
let past = [];
let future = [];
let saved = signature();
let bypass = false;
let tool = 'move';
let zoom = null;
let pan = { x: 0, y: 0 };
let actualZoom = 1;
let gesture = null;
let crop = null;
let pending = null;
let paintPreview = null;
let frame = 0;
let busy = false;
let incoming = 0;

for (const node of document.querySelectorAll('[data-icon]')) setIcon(node, node.dataset.icon);
for (const [value, name] of Object.entries(modes)) $('blend').add(new Option(name, value));

function signature() {
  const { title, width, height, layers } = doc;
  return JSON.stringify([title, width, height, layers]);
}

function message(text) {
  $('status').textContent = text;
}

function report(error) {
  message(error.message);
  window.alert(error.message);
}

function reclaim() {
  let refs = usedAssetIDs([doc, ...past, ...future]);
  while (past.length && assetPixels(refs, assets) > MAX_HISTORY_PIXELS) {
    past.shift();
    refs = usedAssetIDs([doc, ...past, ...future]);
  }
  for (const [id, asset] of assets) {
    if (!refs.has(id)) {
      asset.image.close?.();
      assets.delete(id);
    }
  }
}

function commit(before) {
  if (assetPixels(usedAssetIDs([doc]), assets) > MAX_LIVE_PIXELS) {
    doc = before;
    reclaim();
    refresh();
    throw new Error('This edit would exceed the project’s raster memory limit.');
  }
  past.push(before);
  if (past.length > historyLimit) past.shift();
  future = [];
  reclaim();
  refresh();
}

function finishSlider() {
  if (!pending) return;
  const { before, original, input } = pending;
  pending = null;
  if (input.value !== original) commit(before);
}

function edit(callback) {
  finishSlider();
  cancelGesture();
  const before = structuredClone(doc);
  try {
    callback(doc);
    commit(before);
  } catch (error) {
    doc = before;
    reclaim();
    refresh();
    report(error);
  }
}

function travel(from, to) {
  finishSlider();
  cancelGesture();
  if (!from.length) return;
  to.push(doc);
  const next = from.pop();
  if (next.width !== doc.width || next.height !== doc.height) resetView();
  doc = next;
  crop = null;
  refresh();
}

function loadDocument(next, nextAssets) {
  cancelGesture();
  pending = null;
  assets.forEach(asset => asset.image.close?.());
  doc = next;
  assets = nextAssets;
  past = [];
  future = [];
  saved = signature();
  bypass = false;
  setTool('move');
  resetView();
  refresh();
}

function allowReplacement() {
  finishSlider();
  cancelGesture();
  return signature() === saved || window.confirm('Discard unsaved changes and open another image?');
}

async function runAsync(operation) {
  if (busy) return;
  finishSlider();
  cancelGesture();
  busy = true;
  document.querySelector('.studio').inert = true;
  document.querySelector('.topbar').inert = true;
  try {
    await operation();
  } catch (error) {
    report(error);
  } finally {
    busy = false;
    document.querySelector('.studio').inert = false;
    document.querySelector('.topbar').inert = false;
  }
}

function refresh() {
  $('document-name').textContent = doc.title;
  document.title = `${doc.title} · Tintquarry`;
  $('dimensions').textContent = `${doc.width} × ${doc.height} px`;
  $('dirty').hidden = signature() === saved;
  $('undo').disabled = !past.length;
  $('redo').disabled = !future.length;
  refreshInspector();
  refreshLayers();
  updateView();
  scheduleDraw();
}

function bindRange(input, valueAt, write, show) {
  input.addEventListener('input', () => {
    const layer = activeLayer(doc);
    if (!layer) return;
    if (!pending || pending.input !== input) {
      finishSlider();
      pending = { input, before: structuredClone(doc), original: String(valueAt(layer)) };
    }
    write(layer, input.valueAsNumber);
    show(input.valueAsNumber);
    scheduleDraw();
  });
  input.addEventListener('change', finishSlider);
  input.addEventListener('blur', finishSlider);
}

const colorInputs = new Map();
for (const { key, label, min, max, unit = '' } of adjustments) {
  const row = document.createElement('div');
  row.className = 'adjustment';
  const caption = document.createElement('label');
  caption.htmlFor = key;
  caption.textContent = label;
  const output = document.createElement('output');
  output.htmlFor = key;
  const input = Object.assign(document.createElement('input'), { type: 'range', id: key, min, max, value: 0 });
  const show = value => { output.value = `${value > 0 ? '+' : ''}${value}${unit}`; };
  bindRange(input, layer => layer.adjustments[key], (layer, value) => { layer.adjustments[key] = value; }, show);
  colorInputs.set(key, { input, show });
  row.append(caption, output, input);
  $('adjustments').append(row);
}

const showOpacity = value => { $('opacity-value').value = `${value}%`; };
bindRange($('opacity'), layer => layer.opacity, (layer, value) => { layer.opacity = value; }, showOpacity);

const transformControls = [
  ['offset-x', 'x', -1e6, 1e6], ['offset-y', 'y', -1e6, 1e6],
  ['scale', 'scale', 5, 800], ['rotation', 'rotation', -360, 360],
];
for (const [id, key, min, max] of transformControls) {
  $(id).addEventListener('change', () => {
    const layer = activeLayer(doc);
    const value = $(id).valueAsNumber;
    if (!layer || !Number.isFinite(value)) return refreshInspector();
    edit(() => { activeLayer(doc)[key] = clamp(value, min, max); });
  });
}

function refreshInspector() {
  const layer = activeLayer(doc);
  for (const [key, { input, show }] of colorInputs) {
    const value = layer?.adjustments[key] ?? 0;
    input.disabled = !layer;
    input.value = value;
    show(value);
  }
  for (const [id, key] of transformControls) {
    $(id).disabled = !layer;
    $(id).value = layer ? Math.round(layer[key]) : '';
  }
  for (const [id, key] of [['flip-x', 'flipX'], ['flip-y', 'flipY']]) {
    $(id).disabled = !layer;
    $(id).setAttribute('aria-pressed', Boolean(layer?.[key]));
  }
  $('reset').disabled = !layer || Object.values(layer.adjustments).every(value => value === 0);
  $('blend').disabled = $('opacity').disabled = !layer;
  $('blend').value = layer?.blend ?? 'source-over';
  $('opacity').value = layer?.opacity ?? 100;
  showOpacity(layer?.opacity ?? 100);
  $('compare').setAttribute('aria-pressed', bypass);
  $('compare').lastElementChild.textContent = bypass ? 'Show edits' : 'Before';
}

function refreshLayers() {
  const list = $('layer-list');
  const anchor = list.contains(document.activeElement) ? document.activeElement : null;
  const anchorId = anchor?.closest('li')?.dataset.layer;
  const action = anchor?.className;
  const index = doc.layers.findIndex(layer => layer.id === doc.selected);
  $('layer-count').textContent = doc.layers.length;
  $('layer-up').disabled = index < 0 || index === doc.layers.length - 1;
  $('layer-down').disabled = index <= 0;
  for (const id of ['duplicate', 'rename', 'delete']) $(id).disabled = index < 0;
  list.replaceChildren();

  for (const layer of doc.layers.slice().reverse()) {
    const selected = layer.id === doc.selected;
    const row = document.createElement('li');
    row.className = selected ? 'layer-row current' : 'layer-row';
    row.dataset.layer = layer.id;
    const pick = Object.assign(document.createElement('button'), { className: 'layer-pick' });
    pick.setAttribute('aria-pressed', selected);
    const thumb = Object.assign(document.createElement('span'), { className: 'layer-thumb' });
    if (layer.type === 'fill') thumb.style.background = layer.color;
    if (layer.asset) {
      const image = Object.assign(document.createElement('img'), { alt: '', src: assets.get(layer.asset).url });
      thumb.append(image);
    }
    const name = Object.assign(document.createElement('strong'), { textContent: layer.name });
    const type = Object.assign(document.createElement('small'), {
      textContent: { photo: 'Image', paint: 'Paint', fill: 'Color fill' }[layer.type],
    });
    const label = Object.assign(document.createElement('span'), { className: 'layer-label' });
    label.append(name, type);
    pick.append(thumb, label);
    pick.addEventListener('click', () => {
      finishSlider();
      cancelGesture();
      doc.selected = layer.id;
      refreshInspector();
      refreshLayers();
    });
    const visibility = Object.assign(document.createElement('button'), { className: 'layer-visibility' });
    visibility.dataset.icon = layer.visible ? 'eye' : 'hidden';
    const visibilityLabel = `${layer.visible ? 'Hide' : 'Show'} ${layer.name}`;
    visibility.title = visibilityLabel;
    visibility.setAttribute('aria-label', visibilityLabel);
    setIcon(visibility, visibility.dataset.icon);
    visibility.addEventListener('click', () => edit(() => {
      const current = doc.layers.find(item => item.id === layer.id);
      current.visible = !current.visible;
    }));
    row.append(pick, visibility);
    list.append(row);
    if (layer.id === anchorId) (action === 'layer-visibility' ? visibility : pick).focus({ preventScroll: true });
  }
  if (!doc.layers.length) {
    list.append(Object.assign(document.createElement('li'), {
      className: 'empty-layers', textContent: 'Add a layer to start editing.',
    }));
  }
}

function drawHistogram() {
  const ctx = histSample.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, histSample.width, histSample.height);
  ctx.drawImage(canvas, 0, 0, histSample.width, histSample.height);
  const { data } = ctx.getImageData(0, 0, histSample.width, histSample.height);
  const channels = [new Uint32Array(64), new Uint32Array(64), new Uint32Array(64)];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    for (let c = 0; c < 3; c++) channels[c][data[i + c] >> 2]++;
  }
  const chart = $('histogram');
  const graph = chart.getContext('2d');
  const { width, height } = chart;
  graph.clearRect(0, 0, width, height);
  graph.strokeStyle = '#262a1f1a';
  graph.beginPath();
  for (const x of [width / 4, width / 2, width * 3 / 4]) {
    graph.moveTo(x, 0);
    graph.lineTo(x, height);
  }
  graph.stroke();
  const peak = Math.max(1, ...channels.flatMap(channel => [...channel]));
  const colors = ['#b74736a6', '#53804895', '#495fa8aa'];
  for (const [index, channel] of channels.entries()) {
    graph.beginPath();
    graph.moveTo(0, height);
    channel.forEach((count, bin) => graph.lineTo(bin * width / 63, height - Math.sqrt(count / peak) * (height - 7)));
    graph.lineTo(width, height);
    graph.closePath();
    graph.fillStyle = colors[index];
    graph.fill();
  }
}

function scheduleDraw() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    drawComposite(canvas, doc, assets, { bypass, livePaint: paintPreview });
    drawHistogram();
  });
}

function resetView() {
  zoom = null;
  pan = { x: 0, y: 0 };
}

function updateView() {
  const edge = stage.clientWidth < 550 ? 36 : 102;
  const w = Math.max(1, stage.clientWidth - edge);
  const h = Math.max(1, stage.clientHeight - edge);
  actualZoom = zoom ?? Math.min(w / doc.width, h / doc.height, 1);
  artboard.style.width = `${doc.width * actualZoom}px`;
  artboard.style.height = `${doc.height * actualZoom}px`;
  artboard.style.left = `calc(50% + ${pan.x}px)`;
  artboard.style.top = `calc(50% + ${pan.y}px)`;
  $('zoom-value').textContent = `${Math.max(1, Math.round(actualZoom * 100))}%`;
  updateCrop();
}

function stepZoom(factor) {
  zoom = clamp(actualZoom * factor, 0.02, 8);
  updateView();
}

function setTool(next) {
  cancelGesture();
  tool = next;
  crop = null;
  stage.dataset.tool = tool;
  for (const button of document.querySelectorAll('[data-tool]:is(button)')) {
    button.setAttribute('aria-pressed', button.dataset.tool === tool);
  }
  const isPaint = tool === 'brush' || tool === 'eraser';
  $('tool-options').hidden = !isPaint && tool !== 'crop';
  $('brush-options').hidden = !isPaint;
  $('paint-color').disabled = tool === 'eraser';
  $('crop-options').hidden = tool !== 'crop';
  updateCrop();
}

function pointOnCanvas(event, bounded = false) {
  const bounds = artboard.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / actualZoom;
  const y = (event.clientY - bounds.top) / actualZoom;
  return bounded ? { x: clamp(x, 0, doc.width), y: clamp(y, 0, doc.height) } : { x, y };
}

function updateCrop() {
  const rect = $('crop-rect');
  const display = crop && crop.width > 0 && crop.height > 0;
  rect.hidden = !display;
  $('crop-apply').disabled = !display;
  $('crop-size').textContent = display ? `${crop.width} × ${crop.height} px` : 'Drag to define a crop';
  if (display) {
    for (const [prop, value] of Object.entries({ left: crop.x, top: crop.y, width: crop.width, height: crop.height })) {
      rect.style[prop] = `${value * actualZoom}px`;
    }
  }
}

function applyCrop() {
  if (!crop?.width || !crop.height || gesture) return;
  const { x, y, width, height } = crop;
  edit(() => {
    doc.width = width;
    doc.height = height;
    for (const layer of doc.layers) {
      layer.x = clamp(layer.x - x, -1e6, 1e6);
      layer.y = clamp(layer.y - y, -1e6, 1e6);
    }
    resetView();
  });
  setTool('move');
  message('Canvas cropped');
}

function paintStroke(point) {
  const local = gesture.inverse.transformPoint(point);
  const brush = paintPreview.image.getContext('2d');
  brush.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
  brush.strokeStyle = brush.fillStyle = $('paint-color').value;
  brush.lineWidth = gesture.size;
  brush.lineCap = 'round';
  brush.beginPath();
  const previous = gesture.previous;
  if (previous && (previous.x !== local.x || previous.y !== local.y)) {
    brush.moveTo(previous.x, previous.y);
    brush.lineTo(local.x, local.y);
    brush.stroke();
  } else {
    brush.arc(local.x, local.y, gesture.size / 2, 0, Math.PI * 2);
    brush.fill();
  }
  gesture.previous = local;
  scheduleDraw();
}

function startPainting(layer, point) {
  if (tool === 'eraser' && (layer?.type !== 'paint' || !layer.asset)) {
    message('Select a painted layer to erase.');
    return false;
  }
  if (layer?.type !== 'paint') {
    layer = makeLayer('paint', 'Paint', doc.width, doc.height);
    insertLayer(doc, layer);
  }
  if (!layer.visible) {
    message('Show the selected paint layer first.');
    return false;
  }
  const image = imageCanvas(layer.width, layer.height);
  if (layer.asset) image.getContext('2d').drawImage(assets.get(layer.asset).image, 0, 0);
  paintPreview = { id: layer.id, image };
  gesture.inverse = layerMatrix(layer).inverse();
  gesture.size = $('paint-size').valueAsNumber / (layer.scale / 100);
  paintStroke(point);
  return true;
}

function cancelGesture() {
  if (!gesture) return;
  if (gesture.before) doc = gesture.before;
  if (gesture.tool === 'crop') crop = gesture.previousCrop;
  gesture = null;
  paintPreview = null;
  refresh();
}

stage.addEventListener('pointerdown', event => {
  if (busy || gesture || event.button !== 0 || event.target.closest('.tool-options')) return;
  if (tool !== 'hand' && event.target !== canvas) return;
  const layer = activeLayer(doc);
  if (tool === 'move' && !layer?.visible) return;
  finishSlider();
  const point = pointOnCanvas(event, tool === 'crop');
  gesture = {
    pointerId: event.pointerId, tool, point, previousCrop: crop, layerX: layer?.x, layerY: layer?.y,
    screenX: event.clientX, screenY: event.clientY, pan: { ...pan },
    before: ['hand', 'crop'].includes(tool) ? null : structuredClone(doc),
  };
  try {
    if (['brush', 'eraser'].includes(tool) && !startPainting(layer, point)) {
      cancelGesture();
      return;
    }
  } catch (error) {
    cancelGesture();
    report(error);
    return;
  }
  if (tool === 'crop') {
    crop = null;
    updateCrop();
  }
  stage.setPointerCapture(event.pointerId);
  event.preventDefault();
});

stage.addEventListener('pointermove', event => {
  if (gesture?.pointerId !== event.pointerId) return;
  const point = pointOnCanvas(event, tool === 'crop');
  const start = gesture.point;
  if (tool === 'move') {
    const layer = activeLayer(doc);
    layer.x = clamp(Math.round(gesture.layerX + point.x - start.x), -1e6, 1e6);
    layer.y = clamp(Math.round(gesture.layerY + point.y - start.y), -1e6, 1e6);
    scheduleDraw();
  } else if (tool === 'hand') {
    pan.x = gesture.pan.x + event.clientX - gesture.screenX;
    pan.y = gesture.pan.y + event.clientY - gesture.screenY;
    updateView();
  } else if (tool === 'crop') {
    crop = {
      x: Math.round(Math.min(point.x, start.x)), y: Math.round(Math.min(point.y, start.y)),
      width: Math.abs(Math.round(point.x) - Math.round(start.x)), height: Math.abs(Math.round(point.y) - Math.round(start.y)),
    };
    updateCrop();
  } else {
    paintStroke(point);
  }
});

stage.addEventListener('pointerup', event => {
  if (gesture?.pointerId !== event.pointerId) return;
  const { before, layerX, layerY } = gesture;
  gesture = null;
  try {
    if (paintPreview) {
      const id = newId();
      assets.set(id, canvasAsset(paintPreview.image));
      activeLayer(doc).asset = id;
      paintPreview = null;
      commit(before);
    } else if (tool === 'move' && (layerX !== activeLayer(doc).x || layerY !== activeLayer(doc).y)) {
      commit(before);
    }
  } catch (error) {
    doc = before;
    paintPreview = null;
    reclaim();
    refresh();
    report(error);
  }
});
for (const type of ['pointercancel', 'lostpointercapture']) {
  stage.addEventListener(type, event => {
    if (gesture?.pointerId === event.pointerId) cancelGesture();
  });
}

function rasterLayer(asset, name, bounds) {
  const { width, height } = asset;
  const scale = Math.min(100, 100 * bounds.width / width, 100 * bounds.height / height);
  return makeLayer('photo', name, width, height, {
    asset: newId(), x: Math.round((bounds.width - width) / 2), y: Math.round((bounds.height - height) / 2),
    scale: Math.max(5, scale),
  });
}

function fileTitle(filename) {
  return filename.replace(/\.[^.]+$/, '').trim().slice(0, 100) || 'Untitled';
}

async function loadSample() {
  const response = await fetch(samplePath);
  if (!response.ok) throw new Error('Could not load the sample image.');
  const file = new File([await response.blob()], 'salt-and-sky.jpg');
  const photo = await readRaster(file);
  const next = makeDocument('Salt and Sky', photo.width, photo.height);
  const base = rasterLayer(photo, 'Salt flats', next);
  Object.assign(base.adjustments, { contrast: 4, saturation: 8 });
  insertLayer(next, base);
  insertLayer(next, makeLayer('fill', 'Evening warmth', next.width, next.height, {
    color: '#e19868', opacity: 14, blend: 'soft-light',
  }));
  next.selected = base.id;
  loadDocument(next, new Map([[base.asset, photo]]));
  message('Sample image');
}

function openFile(file) {
  if (!file || busy || !allowReplacement()) return;
  runAsync(async () => {
    message('Opening file…');
    if (/\.tq$/i.test(file.name)) {
      const project = await openProject(file);
      loadDocument(project.doc, project.assets);
    } else {
      const image = await readRaster(file);
      const next = makeDocument(fileTitle(file.name), image.width, image.height);
      const base = rasterLayer(image, fileTitle(file.name), next);
      insertLayer(next, base);
      loadDocument(next, new Map([[base.asset, image]]));
    }
    message('Opened ' + file.name);
  });
}

function importFiles(files) {
  if (!files.length || busy) return;
  runAsync(async () => {
    const before = structuredClone(doc);
    const next = structuredClone(doc);
    const additions = new Map();
    let pixels = assetPixels(usedAssetIDs([doc]), assets);
    message('Importing images…');
    try {
      for (const file of files) {
        const asset = await readRaster(file);
        const layer = rasterLayer(asset, fileTitle(file.name), next);
        additions.set(layer.asset, asset);
        pixels += asset.width * asset.height;
        if (pixels > MAX_LIVE_PIXELS) throw new Error('These images exceed the project’s raster memory limit.');
        insertLayer(next, layer);
      }
    } catch (error) {
      additions.forEach(asset => asset.image.close());
      throw error;
    }
    additions.forEach((asset, id) => assets.set(id, asset));
    doc = next;
    commit(before);
    message(`Imported ${files.length} ${files.length === 1 ? 'image' : 'images'}`);
  });
}

function download(blob, extension) {
  const title = doc.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '') || 'Tintquarry';
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `${title}.${extension}`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function save() {
  finishSlider();
  cancelGesture();
  try {
    download(saveProject(doc, assets), 'tq');
    saved = signature();
    $('dirty').hidden = true;
    message('Project downloaded');
  } catch (error) {
    report(error);
  }
}

function exportPNG() {
  runAsync(async () => {
    const output = imageCanvas(doc.width, doc.height);
    drawComposite(output, doc, assets);
    const blob = await new Promise(resolve => output.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('The browser could not create a PNG.');
    download(blob, 'png');
    message('PNG downloaded');
  });
}

function bumpLayer(delta) {
  const index = doc.layers.findIndex(layer => layer.id === doc.selected);
  const next = index + delta;
  if (index < 0 || next < 0 || next >= doc.layers.length) return;
  edit(() => {
    [doc.layers[index], doc.layers[next]] = [doc.layers[next], doc.layers[index]];
  });
}

function rename() {
  const layer = activeLayer(doc);
  if (!layer) return;
  $('layer-name-input').value = layer.name;
  $('rename-dialog').showModal();
  $('layer-name-input').select();
}

function deleteLayer() {
  if (!doc.selected) return;
  edit(() => {
    const index = doc.layers.findIndex(layer => layer.id === doc.selected);
    doc.layers.splice(index, 1);
    doc.selected = doc.layers[Math.min(index, doc.layers.length - 1)]?.id ?? null;
  });
}

const actions = {
  new: () => $('new-dialog').showModal(),
  open: () => $('open-file').click(),
  save, export: exportPNG, undo: () => travel(past, future), redo: () => travel(future, past),
  fit: () => { resetView(); updateView(); },
  'zoom-in': () => stepZoom(1.25),
  'zoom-out': () => stepZoom(1 / 1.25),
  'zoom-value': () => { zoom = 1; pan = { x: 0, y: 0 }; updateView(); },
  'crop-apply': applyCrop,
  'crop-cancel': () => setTool('move'),
  help: () => $('help-dialog').showModal(),
  'load-sample': () => { $('help-dialog').close(); if (allowReplacement()) runAsync(loadSample); },
  compare: () => { bypass = !bypass; refreshInspector(); scheduleDraw(); },
  reset: () => edit(() => { activeLayer(doc).adjustments = blankAdjustments(); }),
  'flip-x': () => edit(() => { const layer = activeLayer(doc); layer.flipX = !layer.flipX; }),
  'flip-y': () => edit(() => { const layer = activeLayer(doc); layer.flipY = !layer.flipY; }),
  import: () => { $('add-menu').open = false; $('import-files').click(); },
  'add-paint': () => {
    $('add-menu').open = false;
    edit(() => insertLayer(doc, makeLayer('paint', 'Paint', doc.width, doc.height)));
  },
  'add-fill': () => { $('add-menu').open = false; $('fill-dialog').showModal(); },
  'layer-up': () => bumpLayer(1),
  'layer-down': () => bumpLayer(-1),
  duplicate: () => edit(() => {
    const layer = structuredClone(activeLayer(doc));
    layer.id = newId();
    layer.name = `${layer.name.slice(0, 95)} copy`;
    insertLayer(doc, layer);
  }),
  rename, delete: deleteLayer,
};

for (const [id, action] of Object.entries(actions)) $(id).addEventListener('click', action);
for (const button of document.querySelectorAll('button[data-tool]')) {
  button.addEventListener('click', () => setTool(button.dataset.tool));
}
for (const button of document.querySelectorAll('[data-close]')) {
  button.addEventListener('click', () => $(button.dataset.close).close());
}
document.addEventListener('click', event => {
  if (!event.target.closest('#add-menu')) $('add-menu').open = false;
});
$('blend').addEventListener('change', event => edit(() => { activeLayer(doc).blend = event.target.value; }));
$('paint-size').addEventListener('input', event => { $('paint-size-value').value = `${event.target.value} px`; });

$('new-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!allowReplacement()) return;
  const name = $('new-name').value.trim() || 'Untitled';
  loadDocument(makeDocument(name, $('new-width').valueAsNumber, $('new-height').valueAsNumber), new Map());
  $('new-dialog').close();
  message('New transparent canvas');
});

$('fill-form').addEventListener('submit', event => {
  event.preventDefault();
  const color = $('fill-color').value;
  edit(() => insertLayer(doc, makeLayer('fill', 'Color fill', doc.width, doc.height, { color })));
  $('fill-dialog').close();
});

$('rename-form').addEventListener('submit', event => {
  event.preventDefault();
  const name = $('layer-name-input').value.trim();
  if (!name) return;
  edit(() => { activeLayer(doc).name = name; });
  $('rename-dialog').close();
});

$('open-file').addEventListener('change', event => {
  openFile(event.target.files[0]);
  event.target.value = '';
});
$('import-files').addEventListener('change', event => {
  importFiles([...event.target.files]);
  event.target.value = '';
});

for (const name of ['dragover', 'drop']) {
  window.addEventListener(name, event => {
    if (event.dataTransfer.types.includes('Files')) event.preventDefault();
  });
}
stage.addEventListener('dragenter', event => {
  if (event.dataTransfer.types.includes('Files')) {
    incoming++;
    $('drop-hint').hidden = false;
  }
});
stage.addEventListener('dragleave', () => {
  incoming = Math.max(0, incoming - 1);
  if (!incoming) $('drop-hint').hidden = true;
});
stage.addEventListener('drop', event => {
  incoming = 0;
  $('drop-hint').hidden = true;
  const files = [...event.dataTransfer.files];
  if (files.length === 1 && /\.tq$/i.test(files[0].name)) openFile(files[0]);
  else importFiles(files);
});

const hotkeys = { v: 'move', b: 'brush', e: 'eraser', c: 'crop', h: 'hand' };
window.addEventListener('keydown', event => {
  if (busy || document.querySelector('dialog[open]')) return;
  if (event.target.closest?.('input, select, textarea, [contenteditable]')) return;
  const key = event.key.toLowerCase();
  if (event.ctrlKey || event.metaKey) {
    const shortcut = ({ z: event.shiftKey ? actions.redo : actions.undo, y: actions.redo, s: save, o: actions.open })[key];
    if (shortcut) {
      event.preventDefault();
      shortcut();
    }
    return;
  }
  if (event.altKey) return;
  if (Object.hasOwn(hotkeys, key)) setTool(hotkeys[key]);
  if (key === 'escape') {
    if (gesture) cancelGesture();
    else if (tool === 'crop') setTool('move');
  }
  if (key === 'enter' && tool === 'crop' && !event.target.closest?.('button, summary')) applyCrop();
  if (key === '+' || key === '=') actions['zoom-in']();
  if (key === '-') actions['zoom-out']();
  if (key === '0') actions.fit();
});
window.addEventListener('beforeunload', event => {
  if (signature() !== saved) {
    event.preventDefault();
    event.returnValue = true;
  }
});

new ResizeObserver(updateView).observe(stage);
refresh();
runAsync(loadSample);
