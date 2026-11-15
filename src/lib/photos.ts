// On-device photo processing: resize to a 2,048 px long edge, JPEG quality 0.8,
// and make a 320 px thumbnail. Redrawing through a canvas re-encodes the pixels only,
// so EXIF metadata (including GPS location) is not carried into the stored file.
import type { ProcessedPhoto } from '@/db/actions';

export const MAX_EDGE = 2048;
export const THUMB_EDGE = 320;
export const JPEG_QUALITY = 0.8;

function fit(w: number, h: number, max: number) {
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

async function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    // Browsers apply the EXIF orientation when decoding <img> and drawing it to a canvas.
    await img.decode();
    return img;
  } finally {
    // Safe to revoke after decode: the decoded bitmap stays with the element.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function draw(img: HTMLImageElement, max: number) {
  const { width, height } = fit(img.naturalWidth, img.naturalHeight, max);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode JPEG'))), 'image/jpeg', quality));
}

export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  const img = await loadImage(file);
  const full = draw(img, MAX_EDGE);
  const blob = await toBlob(full, JPEG_QUALITY);
  const thumbCanvas = draw(img, THUMB_EDGE);
  const thumb = thumbCanvas.toDataURL('image/jpeg', 0.7);
  // Release canvas memory early (matters on iOS).
  full.width = full.height = 0;
  thumbCanvas.width = thumbCanvas.height = 0;
  const { width, height } = fit(img.naturalWidth, img.naturalHeight, MAX_EDGE);
  return {
    blob,
    width,
    height,
    bytes: blob.size,
    thumb,
    taken_at: new Date(file.lastModified || Date.now()).toISOString(),
    caption: '',
  };
}

/** Processes files one at a time to keep memory low on phones. */
export async function processPhotos(files: FileList | File[], onProgress?: (done: number, total: number) => void) {
  const list = [...files].filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp)$/i.test(f.name));
  const out: ProcessedPhoto[] = [];
  for (const [i, f] of list.entries()) {
    out.push(await processPhoto(f));
    onProgress?.(i + 1, list.length);
  }
  return out;
}
