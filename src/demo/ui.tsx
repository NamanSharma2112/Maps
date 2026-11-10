import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { MapSkeleton } from "../lib";
import { CopyButton } from "./Code";

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className="seg__btn" onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="switch" onClick={() => onChange(!checked)}>
      <span className="switch__track"><span className="switch__thumb" /></span>
      {children}
    </button>
  );
}

/** Saves a file. Works in browsers; sandboxed previews may block it. */
export function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Renders a skeleton until the box scrolls near the viewport, then mounts the real component. */
export function LazyMount({ children, shape = "map", aspect = 2 }: { children: ReactNode; shape?: "map" | "globe"; aspect?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setShown(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className="lazy">{shown ? children : <MapSkeleton shape={shape} aspect={aspect} />}</div>;
}

const PMS = [
  { id: "npm", cmd: "npm i github:NamanSharma2112/Maps" },
  { id: "pnpm", cmd: "pnpm add github:NamanSharma2112/Maps" },
  { id: "yarn", cmd: "yarn add github:NamanSharma2112/Maps" },
  { id: "bun", cmd: "bun add github:NamanSharma2112/Maps" },
];

/** Install command with a package-manager switcher. */
export function InstallTabs() {
  const [pm, setPm] = useState("npm");
  const cmd = PMS.find((p) => p.id === pm)!.cmd;
  return (
    <div className="install-tabs">
      <div className="install-tabs__bar" role="tablist" aria-label="Package manager">
        {PMS.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={pm === p.id} className="install-tabs__tab" onClick={() => setPm(p.id)}>{p.id}</button>
        ))}
      </div>
      <div className="install">
        <code><span className="install__prompt">$</span>{cmd}</code>
        <CopyButton text={cmd} label="Copy install command" />
      </div>
    </div>
  );
}

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
