import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Renders bottom sheets on document.body so page animations (transform) cannot trap position:fixed. */
export function SheetPortal({ children }: { children: ReactNode }) {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setMount(document.body);
  }, []);
  if (!mount) return null;
  return createPortal(children, mount);
}
