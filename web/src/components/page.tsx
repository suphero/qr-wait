import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Page({ className, children }: { className?: string; children: ReactNode }) {
  return <main className={cn("mx-auto flex max-w-[560px] flex-col gap-3 p-4 text-[17px]", className)}>{children}</main>;
}

export function Title({ className, children }: { className?: string; children: ReactNode }) {
  return <h1 className={cn("mt-3 text-2xl font-bold text-primary", className)}>{children}</h1>;
}

export function ErrorText({ children }: { children?: ReactNode }) {
  return children ? <p role="alert" className="font-semibold text-destructive">{children}</p> : null;
}
