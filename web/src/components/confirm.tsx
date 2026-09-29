import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { S } from "@/lib/i18n";

type Opts = {
  title: ReactNode;
  description?: ReactNode;
  action?: string;
  cancel?: string | false; // false: yalnızca bilgi, tek buton (alert yerine)
  destructive?: boolean;
};

// Tarayıcının confirm()/alert() kutuları yerine: `if (await confirm({ title: "…" })) …`
const Ctx = createContext<(o: Opts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(Ctx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<Opts | null>(null);
  const resolve = useRef<(v: boolean) => void>(undefined);
  const ask = useCallback((o: Opts) => new Promise<boolean>((r) => { resolve.current = r; setOpts(o); }), []);
  const close = (v: boolean) => { resolve.current?.(v); resolve.current = undefined; setOpts(null); };

  return (
    <Ctx.Provider value={ask}>
      {children}
      <AlertDialog open={!!opts} onOpenChange={(o) => !o && close(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{opts?.title}</AlertDialogTitle>
            {opts?.description && <AlertDialogDescription>{opts.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            {opts?.cancel !== false && <AlertDialogCancel onClick={() => close(false)}>{opts?.cancel ?? S.cancel}</AlertDialogCancel>}
            <AlertDialogAction variant={opts?.destructive ? "destructive" : "default"} onClick={() => close(true)}>
              {opts?.action ?? S.ok}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Ctx.Provider>
  );
}
