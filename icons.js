const paths = {
  undo: '<path d="M9 5 4 10l5 5M4 10h10a5 5 0 0 1 0 10"/>',
  redo: '<path d="m15 5 5 5-5 5m5-5H10a5 5 0 0 0 0 10"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M5 15v5h14v-5"/>',
  move: '<path d="m4 3 15 9-7 1-3 7L4 3Zm8 10 5 6"/>',
  brush: '<path d="m10 14 8-10c.5-.6 1.5-.7 2.1-.1.6.5.7 1.4.2 2l-8.1 10.5M4 20c2 0 2.1-1.7 2.5-3.2.5-2 2.8-2.9 4.4-1.6 1.6 1.2 1.6 3.2.2 4.2-1.2.9-4.1 1.3-7.1.6Z"/>',
  eraser: '<path d="M9 20h11M5 16l-1-1a2 2 0 0 1 0-3l8-8a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-8 8H9Zm2-7 8 8"/>',
  crop: '<path d="M6 3v14h15M3 7h14v14"/>',
  hand: '<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v5a7 7 0 0 1-7 7h-1c-2 0-3.5-1-4.7-2.6l-3.4-4.5c-.9-1.3.7-3 2-2l2.1 2"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .8-1.5 1.2-1.5 2.5M12 17h.01"/>',
  picture: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1"/><path d="m4 17 5-5 4 4 3-4 4 4"/>',
  compare: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14M15 9h3m-3 3h3m-3 3h3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  up: '<path d="M12 20V4m-5 5 5-5 5 5"/>',
  down: '<path d="M12 4v16m-5-5 5 5 5-5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 5V4H4v12h1"/>',
  edit: '<path d="m5 16-1 4 4-1L20 7l-3-3L5 16Zm9-9 3 3"/>',
  trash: '<path d="M4 6h16m-13 0 1 14h8l1-14m-7 0V3h4v3"/>',
  eye: '<path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/>',
  hidden: '<path d="m4 4 16 16M9 6.5a10 10 0 0 1 3-.5c6 0 10 6 10 6a17 17 0 0 1-3 3.2M6.8 7.1A18 18 0 0 0 2 12s4 6 10 6c1.1 0 2.1-.2 3-.5"/>',
};

export function setIcon(node, name) {
  node.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
}
