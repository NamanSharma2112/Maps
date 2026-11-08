import { useState } from "react";

const TOKEN = /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`]*`)|(<\/?[A-Z][\w.]*|<\/?[a-z][\w-]*|\/?>)|\b(import|from|export|const|return|function|true|false|null)\b|\b(\d[\d_.]*)\b|([a-zA-Z_][\w]*)(?==)/g;

function highlight(code: string) {
  const out: (string | JSX.Element)[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(code))) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const cls = m[1] ? "c" : m[2] ? "s" : m[3] ? "t" : m[4] ? "k" : m[5] ? "n" : "a";
    out.push(<span key={i++} className={`tok-${cls}`}>{m[0]}</span>);
    last = m.index + m[0].length;
  }
  out.push(code.slice(last));
  return out;
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="copy"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => { setDone(true); setTimeout(() => setDone(false), 1400); },
          () => {},
        );
      }}
      aria-label={label}
    >
      {done ? (
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" /></svg>
      ) : (
        <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.25" y="5.25" width="8" height="8" rx="1.5" /><path d="M10.75 5.25v-1.5a1.5 1.5 0 0 0-1.5-1.5h-5a1.5 1.5 0 0 0-1.5 1.5v5a1.5 1.5 0 0 0 1.5 1.5h1.5" /></svg>
      )}
    </button>
  );
}

export function Code({ code }: { code: string }) {
  return (
    <div className="code">
      <CopyButton text={code} label="Copy code" />
      <pre><code>{highlight(code)}</code></pre>
    </div>
  );
}
