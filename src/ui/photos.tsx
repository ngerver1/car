import * as Dialog from '@radix-ui/react-dialog';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import type { ProcessedPhoto } from '@/db/actions';
import { getDb } from '@/db/repo';
import type { Photo } from '@/domain/schemas';
import { useObjectUrl } from '@/lib/hooks';
import { processPhotos } from '@/lib/photos';
import { useConfirm } from './dialog';
import { IconCamera, IconChevronL, IconChevronR, IconImage, IconTrash, IconX } from './icons';

/** Camera and library buttons. Files are resized on the device before being handed back. */
export function PhotoPicker({ onPicked, label = 'Photos' }: { onPicked: (p: ProcessedPhoto[]) => void | Promise<void>; label?: string }) {
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(files: FileList | null, input: HTMLInputElement | null) {
    if (!files?.length) return;
    setError(null);
    try {
      setProgress(`Processing 0 of ${files.length}…`);
      const processed = await processPhotos(files, (d, t) => setProgress(`Processing ${d} of ${t}…`));
      await onPicked(processed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that photo');
    } finally {
      setProgress(null);
      if (input) input.value = '';
    }
  }

  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" onClick={() => camera.current?.click()} disabled={!!progress}>
          <IconCamera className="size-5" /> Camera
        </button>
        <button type="button" className="btn" onClick={() => library.current?.click()} disabled={!!progress}>
          <IconImage className="size-5" /> Library
        </button>
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          data-testid="photo-camera-input"
          onChange={(e) => handle(e.target.files, e.target)}
        />
        <input
          ref={library}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          data-testid="photo-library-input"
          onChange={(e) => handle(e.target.files, e.target)}
        />
      </div>
      {progress && (
        <p className="muted text-sm mt-2" role="status">
          {progress}
        </p>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function Thumb({ src, alt, onClick }: { src: string; alt: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block aspect-square overflow-hidden rounded-lg border"
      style={{ borderColor: 'var(--border)', contentVisibility: 'auto' }}
    >
      <img src={src} alt={alt} loading="lazy" decoding="async" className="size-full object-cover" width={160} height={160} />
    </button>
  );
}

/** Photos picked in a form but not yet saved. */
export function PendingPhotos({ photos, onRemove }: { photos: ProcessedPhoto[]; onRemove: (i: number) => void }) {
  if (!photos.length) return null;
  return (
    <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6" data-testid="pending-photos">
      {photos.map((p, i) => (
        <div key={i} className="relative">
          <img src={p.thumb} alt={`New photo ${i + 1}`} className="aspect-square w-full rounded-lg object-cover" />
          <button
            type="button"
            className="absolute right-1 top-1 rounded-full bg-black/70 p-1.5 text-white"
            aria-label={`Remove new photo ${i + 1}`}
            onClick={() => onRemove(i)}
          >
            <IconX className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Saved photos as a thumbnail grid; tap to open the viewer. */
export function PhotoGrid({ photos, onDelete, size = 'md' }: { photos: Photo[]; onDelete?: (p: Photo) => void; size?: 'sm' | 'md' }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!photos.length) return null;
  return (
    <>
      <div className={`grid gap-2 ${size === 'sm' ? 'grid-cols-5 sm:grid-cols-8' : 'grid-cols-3 sm:grid-cols-5'}`} data-testid="photo-grid">
        {photos.map((p, i) => (
          <Thumb key={p.id} src={p.thumb} alt={p.caption || `Photo ${i + 1}`} onClick={() => setOpen(i)} />
        ))}
      </div>
      <PhotoViewer photos={photos} index={open} onIndex={setOpen} onDelete={onDelete} />
    </>
  );
}

function FullImage({ photo }: { photo: Photo }) {
  const blob = useLiveQuery(
    async () => (photo.local_blob_key ? (await getDb().photo_blobs.get(photo.local_blob_key))?.blob : undefined),
    [photo.local_blob_key],
  );
  const url = useObjectUrl(blob);
  return <img src={url ?? photo.thumb} alt={photo.caption || 'Photo'} className="max-h-full max-w-full object-contain" data-testid="viewer-image" />;
}

export function PhotoViewer(props: { photos: Photo[]; index: number | null; onIndex: (i: number | null) => void; onDelete?: (p: Photo) => void }) {
  const confirm = useConfirm();
  const { photos, index } = props;
  const photo = index != null ? photos[index] : undefined;
  const go = (d: number) => index != null && props.onIndex((index + d + photos.length) % photos.length);
  const touchX = useRef<number | null>(null);
  return (
    <Dialog.Root open={!!photo} onOpenChange={(o) => !o && props.onIndex(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/95" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex flex-col text-white outline-none"
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') go(1);
            if (e.key === 'ArrowLeft') go(-1);
          }}
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current == null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
            touchX.current = null;
          }}
        >
          <div className="flex items-center justify-between gap-2 p-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <Dialog.Title className="px-2 text-sm">
              {index != null ? `${index + 1} of ${photos.length}` : ''}
              {photo && (
                <span className="ml-2 opacity-70">
                  {photo.width}×{photo.height}
                </span>
              )}
            </Dialog.Title>
            <Dialog.Description className="sr-only">Photo viewer</Dialog.Description>
            <div className="flex gap-1">
              {props.onDelete && photo && (
                <button
                  type="button"
                  className="btn btn-ghost text-white"
                  aria-label="Delete photo"
                  onClick={async () => {
                    if (await confirm({ title: 'Delete this photo?', confirmLabel: 'Delete', danger: true })) {
                      props.onDelete?.(photo);
                      props.onIndex(null);
                    }
                  }}
                >
                  <IconTrash className="size-5" />
                </button>
              )}
              <Dialog.Close className="btn btn-ghost text-white" aria-label="Close viewer">
                <IconX className="size-5" />
              </Dialog.Close>
            </div>
          </div>
          <div className="relative flex flex-1 items-center justify-center overflow-hidden">
            {photo && <FullImage photo={photo} />}
            {photos.length > 1 && (
              <>
                <button type="button" className="absolute left-2 rounded-full bg-black/50 p-3" aria-label="Previous photo" onClick={() => go(-1)}>
                  <IconChevronL />
                </button>
                <button type="button" className="absolute right-2 rounded-full bg-black/50 p-3" aria-label="Next photo" onClick={() => go(1)}>
                  <IconChevronR />
                </button>
              </>
            )}
          </div>
          {photo?.caption && <p className="p-3 text-center text-sm">{photo.caption}</p>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Live query of a parent's photos, oldest first. */
export function usePhotos(parentId: string | undefined) {
  return useLiveQuery(
    async () =>
      parentId
        ? (await getDb().photos.where('parent_id').equals(parentId).toArray())
            .filter((p) => !p.deleted)
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
        : [],
    [parentId],
  );
}
