import * as Dialog from '@radix-ui/react-dialog';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { IconX } from './icons';

/** Bottom sheet on phones, centred dialog on larger screens. */
export function Sheet(props: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: ReactNode; description?: string }) {
  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          className="card fixed z-50 inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-b-none p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"
          aria-describedby={props.description ? undefined : undefined}
        >
          <div className="flex items-start justify-between gap-4 mb-3">
            <Dialog.Title className="text-lg font-semibold">{props.title}</Dialog.Title>
            <Dialog.Close className="btn btn-ghost -mr-2 -mt-1 px-2" aria-label="Close">
              <IconX className="size-5" />
            </Dialog.Close>
          </div>
          {props.description ? (
            <Dialog.Description className="muted text-sm mb-3">{props.description}</Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">{props.title}</Dialog.Description>
          )}
          {props.children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

const ConfirmCtx = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>(undefined);
  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    return new Promise<boolean>((res) => {
      resolver.current = res;
    });
  }, []);
  const done = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = undefined;
    setOpts(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Sheet open={!!opts} onOpenChange={(o) => !o && done(false)} title={opts?.title ?? ''}>
        {opts?.message && <p className="mb-4 text-sm">{opts.message}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => done(false)}>
            {opts?.cancelLabel ?? 'Cancel'}
          </button>
          <button type="button" className={`btn ${opts?.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => done(true)} autoFocus>
            {opts?.confirmLabel ?? 'OK'}
          </button>
        </div>
      </Sheet>
    </ConfirmCtx.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmCtx);
