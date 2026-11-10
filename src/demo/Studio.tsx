import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { VideoMap, CITIES, findCity, getCountryRegions } from "../lib";
import type { VideoAspect, VideoMapHandle, VideoStop, VideoTheme } from "../lib";
import { Segmented, Toggle, save, fmtTime } from "./ui";
import { Code } from "./Code";

/* ── project model ──────────────────────────────────────────── */

type StopKind = "country" | "city";
interface StopDraft { id: string; kind: StopKind; value: string; label: string; depth: number | null }
interface Project {
  stops: StopDraft[];
  title: string; subtitle: string; outro: string;
  aspect: VideoAspect; resolution: 720 | 1080 | 1440 | 2160; fps: 30 | 60;
  theme: VideoTheme; accent: string; background: "theme" | "green" | "transparent"; variant: "solid" | "dots";
  routeStyle: "glow" | "dashed" | "solid" | "none"; vehicle: "plane" | "dot" | "none"; captionStyle: "lower-third" | "pill" | "none";
  flight: number; hold: number; speed: number;
  progress: boolean; vignette: boolean; showDistance: boolean;
}

let seq = 0;
const uid = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`;
const city = (value: string, depth: number | null = null, label = ""): StopDraft => ({ id: uid(), kind: "city", value, label, depth });
const country = (value: string, depth: number | null = null, label = ""): StopDraft => ({ id: uid(), kind: "country", value, label, depth });

const BASE: Omit<Project, "stops" | "title" | "subtitle" | "outro"> = {
  aspect: "16:9", resolution: 1080, fps: 30, theme: "midnight", accent: "", background: "theme", variant: "solid",
  routeStyle: "glow", vehicle: "plane", captionStyle: "lower-third", flight: 1.8, hold: 1.6, speed: 1,
  progress: true, vignette: true, showDistance: true,
};

const TEMPLATES: { id: string; name: string; make: () => Project }[] = [
  { id: "trip", name: "Delhi → London → New York", make: () => ({ ...BASE, title: "Delhi to New York", subtitle: "Via London", outro: "Follow for part 2", stops: [city("New Delhi"), city("London"), city("New York")] }) },
  { id: "india", name: "India road trip", make: () => ({ ...BASE, theme: "sand", routeStyle: "dashed", title: "India in 10 days", subtitle: "Six cities, north to south", outro: "Full itinerary in the description", stops: [city("New Delhi", 7), city("Jaipur", 7), city("Udaipur", 7), city("Mumbai", 7), city("Goa (Panaji)", 7), city("Kochi", 7)] }) },
  { id: "europe", name: "Europe by rail", make: () => ({ ...BASE, theme: "light", title: "Interrail summer", subtitle: "Paris → Rome", outro: "", stops: [city("Paris", 6), city("Zurich", 6), city("Vienna", 6), city("Venice", 6), city("Rome", 6)] }) },
  { id: "asia", name: "Asia country hop", make: () => ({ ...BASE, theme: "dark", title: "Asia in 60 seconds", subtitle: "Five countries, one route", outro: "", stops: [country("India"), country("Thailand"), country("Vietnam"), country("China"), country("Japan")] }) },
  { id: "world", name: "Around the world", make: () => ({ ...BASE, routeStyle: "solid", title: "Around the world", subtitle: "Eight cities, five continents", outro: "Subscribe for the full trip", flight: 2.2, stops: [city("London", 3), city("Dubai", 3), city("Mumbai", 3), city("Bangkok", 3), city("Tokyo", 3), city("Sydney", 3), city("San Francisco", 3), city("New York", 3)] }) },
];

const STORE = "meridian-studio-v1";
function loadProject(): Project {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) return { ...TEMPLATES[0].make(), ...JSON.parse(raw) };
  } catch { /* storage blocked: start from a template */ }
  return TEMPLATES[0].make();
}

const COUNTRY_NAMES = getCountryRegions().map((r) => r.name).filter((n) => n !== "Antarctica").sort();
const CITY_NAMES = CITIES.map((c) => c.name).sort();

function resolve(s: StopDraft): VideoStop | null {
  if (s.kind === "city") {
    const c = findCity(s.value);
    if (!c) return null;
    return { country: c.country, at: { lat: c.lat, lng: c.lng }, zoom: s.depth ?? 6, label: s.label || `${c.name}, ${c.country === "United States of America" ? "USA" : c.country}` };
  }
  const name = COUNTRY_NAMES.find((n) => n.toLowerCase() === s.value.trim().toLowerCase());
  if (!name) return null;
  return { country: name, ...(s.depth ? { zoom: s.depth } : {}), ...(s.label ? { label: s.label } : {}) };
}

/* ── small pieces ───────────────────────────────────────────── */

function Panel({ title, hint, children, open = true }: { title: string; hint?: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="panel" open={open}>
      <summary className="panel__head">
        <span>{title}</span>
        {hint && <span className="panel__hint">{hint}</span>}
        <svg viewBox="0 0 16 16" aria-hidden="true" className="panel__chev"><path d="M4 6l4 4 4-4" /></svg>
      </summary>
      <div className="panel__body">{children}</div>
    </details>
  );
}

function Field({ label, htmlFor, children, aside }: { label: string; htmlFor?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="field">
      <div className="field__top"><label htmlFor={htmlFor}>{label}</label>{aside}</div>
      {children}
    </div>
  );
}

function Slider({ id, value, min, max, step, onChange, suffix }: { id: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; suffix: string }) {
  return (
    <div className="slider">
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        style={{ ["--fill" as string]: `${((value - min) / (max - min)) * 100}%` }} />
      <output htmlFor={id}>{value}{suffix}</output>
    </div>
  );
}

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 16 16" aria-hidden="true" className="ico"><path d={d} /></svg>
);

const FORMATS: { value: VideoAspect; name: string; use: string }[] = [
  { value: "16:9", name: "Landscape", use: "YouTube" },
  { value: "9:16", name: "Vertical", use: "Reels · Shorts · TikTok" },
  { value: "1:1", name: "Square", use: "Feed post" },
  { value: "4:5", name: "Portrait", use: "Instagram feed" },
];
const THEMES: { value: VideoTheme; name: string; bg: string; land: string; accent: string }[] = [
  { value: "midnight", name: "Midnight", bg: "#06101d", land: "#14243a", accent: "#38bdf8" },
  { value: "dark", name: "Dark", bg: "#09090b", land: "#232327", accent: "#8b8cff" },
  { value: "light", name: "Light", bg: "#f6f6f7", land: "#e2e2e6", accent: "#5b5bf0" },
  { value: "sand", name: "Sand", bg: "#f2ebdf", land: "#dccdb3", accent: "#d9480f" },
  { value: "auto", name: "Site", bg: "var(--mr-background)", land: "var(--mr-land)", accent: "var(--mr-accent)" },
];

/* ── studio ─────────────────────────────────────────────────── */

export function Studio() {
  const [p, setP] = useState<Project>(loadProject);
  const set = <K extends keyof Project>(k: K, v: Project[K]) => setP((x) => ({ ...x, [k]: v }));
  const [playing, setPlaying] = useState(true);
  const [time, setTime] = useState(0);
  const [status, setStatus] = useState("");
  const [recording, setRecording] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const map = useRef<VideoMapHandle>(null);
  const lastTick = useRef(0);
  const scrubbing = useRef<{ wasPlaying: boolean } | null>(null);
  const startScrub = () => { if (!scrubbing.current) { scrubbing.current = { wasPlaying: playing }; setPlaying(false); } };
  const endScrub = () => { const s = scrubbing.current; scrubbing.current = null; if (s?.wasPlaying) setPlaying(true); };

  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify(p)); } catch { /* not saved; fine */ }
  }, [p]);

  const resolved = useMemo(() => p.stops.map(resolve), [p.stops]);
  const stops = useMemo(() => resolved.filter((s): s is VideoStop => !!s), [resolved]);
  const [duration, setDuration] = useState(0);
  const seg = p.flight + p.hold;
  const marks = stops.map((_, i) => 0.8 + i * seg + p.flight); // when the camera lands on each stop

  const updateStop = (id: string, patch: Partial<StopDraft>) => set("stops", p.stops.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= p.stops.length) return;
    const next = [...p.stops];
    [next[i], next[j]] = [next[j], next[i]];
    set("stops", next);
  };

  const record = async () => {
    if (!map.current || recording) return;
    setRecording(true);
    setPlaying(true);
    setStatus(`Recording ${fmtTime(map.current.duration)} at ${p.resolution}p, ${p.fps} fps. Keep this tab open.`);
    try {
      const blob = await map.current.record();
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      save(blob, `${(p.title || "map").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${p.aspect.replace(":", "x")}.${ext}`);
      setStatus(`Saved ${(blob.size / 1e6).toFixed(1)} MB ${ext.toUpperCase()}. If no file appeared, this preview cannot save files: open the site on your own deployment.`);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setRecording(false);
    }
  };
  const frame = async () => {
    const blob = await map.current?.snapshot();
    if (blob) { save(blob, `map-frame-${p.aspect.replace(":", "x")}.png`); setStatus("Saved a PNG of the current frame."); }
  };

  const code = `import { VideoMap } from "meridian-ui";

<VideoMap
  aspect="${p.aspect}"
  resolution={${p.resolution}}
  theme="${p.theme}"${p.accent ? `\n  accent="${p.accent}"` : ""}
  background="${p.background}"
  variant="${p.variant}"
  routeStyle="${p.routeStyle}"
  vehicle="${p.vehicle}"
  captionStyle="${p.captionStyle}"
  flight={${p.flight}}
  hold={${p.hold}}${p.title ? `\n  title="${p.title}"` : ""}${p.subtitle ? `\n  subtitle="${p.subtitle}"` : ""}${p.outro ? `\n  outro="${p.outro}"` : ""}
  stops={[
${stops.map((s) => `    { country: "${s.country}"${s.at ? `, at: { lat: ${s.at.lat}, lng: ${s.at.lng} }` : ""}${s.zoom ? `, zoom: ${s.zoom}` : ""}${s.label ? `, label: "${s.label}"` : ""} },`).join("\n")}
  ]}
/>`;

  const fmtLabel = FORMATS.find((f) => f.value === p.aspect)!;
  return (
    <div className="studio dark">
      <datalist id="studio-countries">{COUNTRY_NAMES.map((n) => <option key={n} value={n} />)}</datalist>
      <datalist id="studio-cities">{CITY_NAMES.map((n) => <option key={n} value={n} />)}</datalist>

      {/* ── top bar ── */}
      <header className="studio__bar">
        <div className="studio__brand">
          <span className="studio__logo" aria-hidden="true" />
          <b>Creator Studio</b>
          <span className="studio__doc">{p.title || "Untitled route"}</span>
        </div>
        <select
          className="studio__select"
          aria-label="Start from a template"
          value=""
          onChange={(e) => { const t = TEMPLATES.find((x) => x.id === e.target.value); if (t) { setP(t.make()); map.current?.replay(); setPlaying(true); } }}
        >
          <option value="" disabled>Templates…</option>
          {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div className="studio__formats" role="radiogroup" aria-label="Frame">
          {FORMATS.map((f) => (
            <button key={f.value} type="button" role="radio" aria-checked={p.aspect === f.value} className="fmt" onClick={() => set("aspect", f.value)} title={`${f.name} · ${f.use}`}>
              <span className={`format__frame format__frame--${f.value.replace(":", "x")}`} />
              {f.value}
            </button>
          ))}
        </div>
        <div className="studio__actions">
          <button type="button" className="sbtn" onClick={() => setShowCode((x) => !x)} aria-expanded={showCode}><Icon d="M6 4.5L2.5 8 6 11.5M10 4.5L13.5 8 10 11.5" />Code</button>
          <button type="button" className="sbtn" onClick={frame} disabled={recording || !stops.length}><Icon d="M2.5 4.5h11v8h-11zM5.5 4.5l1-2h3l1 2M8 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />PNG</button>
          <button type="button" className="sbtn sbtn--primary" onClick={record} disabled={recording || !stops.length}>
            {recording ? <span className="rec-dot" aria-hidden="true" /> : <Icon d="M3 4.5h7v7H3zM10 7l3.5-2v6L10 9" />}
            {recording ? "Recording…" : "Export video"}
          </button>
        </div>
      </header>

      {/* ── left: route ── */}
      <aside className="studio__left" aria-label="Route">
        <Panel title="Route" hint={`${stops.length} stop${stops.length === 1 ? "" : "s"}`}>
          <ol className="stops">
            {p.stops.map((s, i) => {
              const ok = !!resolved[i];
              return (
                <li key={s.id} className={`stop${ok ? "" : " is-invalid"}`}>
                  <div className="stop__row">
                    <span className="stop__n">{i + 1}</span>
                    <select aria-label={`Stop ${i + 1} type`} value={s.kind} onChange={(e) => updateStop(s.id, { kind: e.target.value as StopKind, value: "" })}>
                      <option value="city">City</option>
                      <option value="country">Country</option>
                    </select>
                    <input
                      aria-label={`Stop ${i + 1} ${s.kind}`}
                      list={s.kind === "city" ? "studio-cities" : "studio-countries"}
                      value={s.value}
                      placeholder={s.kind === "city" ? "Search a city…" : "Search a country…"}
                      onChange={(e) => updateStop(s.id, { value: e.target.value })}
                    />
                    <div className="stop__tools">
                      <button type="button" className="tool" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move stop ${i + 1} up`}><Icon d="M8 12.5v-9M4.5 7L8 3.5 11.5 7" /></button>
                      <button type="button" className="tool" onClick={() => move(i, 1)} disabled={i === p.stops.length - 1} aria-label={`Move stop ${i + 1} down`}><Icon d="M8 3.5v9M4.5 9L8 12.5 11.5 9" /></button>
                      <button type="button" className="tool" onClick={() => set("stops", p.stops.filter((x) => x.id !== s.id))} disabled={p.stops.length <= 1} aria-label={`Remove stop ${i + 1}`}><Icon d="M4 4l8 8M12 4l-8 8" /></button>
                    </div>
                  </div>
                  {!ok && s.value && <p className="stop__err">Not found. Pick a {s.kind} from the list.</p>}
                  <div className="stop__row stop__row--sub">
                    <input aria-label={`Stop ${i + 1} caption`} value={s.label} placeholder="Caption" onChange={(e) => updateStop(s.id, { label: e.target.value })} />
                    <label className="depth">
                      <span>Depth</span>
                      <input
                        type="range" min={1} max={14} step={0.5}
                        value={s.depth ?? (s.kind === "city" ? 6 : 4)}
                        style={{ ["--fill" as string]: `${(((s.depth ?? (s.kind === "city" ? 6 : 4)) - 1) / 13) * 100}%` }}
                        onChange={(e) => updateStop(s.id, { depth: Number(e.target.value) })}
                        aria-label={`Stop ${i + 1} zoom depth`}
                      />
                      <button type="button" className={`depth__auto${s.depth === null ? " is-on" : ""}`} onClick={() => updateStop(s.id, { depth: null })} aria-pressed={s.depth === null}>
                        {s.depth === null ? "Auto" : `${s.depth}×`}
                      </button>
                    </label>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="row-actions">
            <button type="button" className="btn btn--sm" onClick={() => set("stops", [...p.stops, city("")])}><Icon d="M8 3.5v9M3.5 8h9" />Add city</button>
            <button type="button" className="btn btn--sm" onClick={() => set("stops", [...p.stops, country("")])}><Icon d="M8 3.5v9M3.5 8h9" />Add country</button>
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => set("stops", [...p.stops].reverse())}>Reverse</button>
          </div>
        </Panel>

      </aside>

      {/* ── centre: canvas + timeline ── */}
      <section className="studio__center" aria-label="Preview">
        <div className={`studio__stage studio__stage--${p.aspect.replace(":", "x")}${p.background === "transparent" ? " is-checker" : ""}`}>
          {stops.length ? (
            <VideoMap
              ref={map}
              key={`${p.aspect}-${p.resolution}-${p.variant}`}
              stops={stops}
              aspect={p.aspect}
              resolution={p.resolution}
              fps={p.fps}
              theme={p.theme}
              accent={p.accent || undefined}
              background={p.background}
              variant={p.variant}
              routeStyle={p.routeStyle}
              vehicle={p.vehicle}
              captionStyle={p.captionStyle}
              showDistance={p.showDistance}
              progress={p.progress}
              vignette={p.vignette}
              flight={p.flight}
              hold={p.hold}
              speed={p.speed}
              title={p.title || undefined}
              subtitle={p.subtitle || undefined}
              outro={p.outro || undefined}
              playing={playing}
              onProgress={(t, d) => {
                if (d !== duration) setDuration(d);
                if (scrubbing.current) return; // the scrubber owns the playhead while dragging
                const now = performance.now();
                if (now - lastTick.current > 50) { lastTick.current = now; setTime(t); }
              }}
            />
          ) : (
            <p className="studio__empty">Add a city or country to start.</p>
          )}
        </div>

        <div className="timeline">
          <div className="timeline__controls">
            <button type="button" className="tool tool--lg" onClick={() => setPlaying((x) => !x)} aria-label={playing ? "Pause" : "Play"} disabled={recording}>
              {playing ? <Icon d="M5.5 3.5v9M10.5 3.5v9" /> : <Icon d="M5 3.2v9.6L12.6 8z" />}
            </button>
            <button type="button" className="tool tool--lg" onClick={() => { map.current?.replay(); setPlaying(true); }} aria-label="Replay from start" disabled={recording}>
              <Icon d="M2.75 8a5.25 5.25 0 1 0 1.54-3.71M2.75 2.75v2.5h2.5" />
            </button>
            <span className="timeline__time">{fmtTime(time / p.speed)} <span>/ {fmtTime(duration / p.speed)}</span></span>
          </div>
          <div className="timeline__track">
            <div className="timeline__marks" aria-hidden="true">
              {duration > 0 && marks.map((m, i) => (
                <button key={i} type="button" tabIndex={-1} className="timeline__mark" style={{ left: `calc(9px + (100% - 18px) * ${m / duration})` }} onClick={() => { map.current?.seek(m); setTime(m); }}>
                  {i + 1}
                </button>
              ))}
            </div>
            <input
              className="scrub"
              type="range"
              min={0}
              max={duration || 1}
              step={0.01}
              value={Math.min(time, duration || 1)}
              onPointerDown={startScrub}
              onPointerUp={endScrub}
              onPointerCancel={endScrub}
              onBlur={() => scrubbing.current && endScrub()}
              onChange={(e) => { const v = Number(e.target.value); map.current?.seek(v); setTime(v); }}
              style={{ ["--fill" as string]: `${duration ? (Math.min(time, duration) / duration) * 100 : 0}%` }}
              aria-label="Playhead"
              aria-valuetext={`${fmtTime(time / p.speed)} of ${fmtTime(duration / p.speed)}`}
              disabled={recording}
            />
          </div>
        </div>
        {showCode && <div className="studio__code"><Code code={code} /></div>}
      </section>

      {/* ── right: properties ── */}
      <aside className="studio__right" aria-label="Properties">
        <Panel title="Output" hint={`${p.resolution}p · ${p.fps}`}>
          <div className="field-grid field-grid--wide">
            <Field label="Resolution"><Segmented label="Resolution" value={String(p.resolution)} onChange={(v) => set("resolution", Number(v) as Project["resolution"])} options={[{ value: "720", label: "720p" }, { value: "1080", label: "1080p" }, { value: "1440", label: "2K" }, { value: "2160", label: "4K" }]} /></Field>
            <Field label="Frame rate"><Segmented label="Frame rate" value={String(p.fps)} onChange={(v) => set("fps", Number(v) as 30 | 60)} options={[{ value: "30", label: "30 fps" }, { value: "60", label: "60 fps" }]} /></Field>
          </div>
        </Panel>

        <Panel title="Style">
          <Field label="Theme">
            <div className="swatches" role="radiogroup" aria-label="Theme">
              {THEMES.map((t) => (
                <button key={t.value} type="button" role="radio" aria-checked={p.theme === t.value} className="swatch" onClick={() => set("theme", t.value)} title={t.name}>
                  <span className="swatch__chip" style={{ background: t.bg }}>
                    <span style={{ background: t.land }} />
                    <span style={{ background: t.accent }} />
                  </span>
                  <span className="swatch__name">{t.name}</span>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Brand colour" htmlFor="studio-accent" aside={p.accent ? <button type="button" className="link" onClick={() => set("accent", "")}>Reset</button> : <span className="muted">Theme default</span>}>
            <div className="color">
              <input id="studio-accent" type="color" value={p.accent || THEMES.find((t) => t.value === p.theme)?.accent.replace(/^var.*/, "#6366f1") || "#6366f1"} onChange={(e) => set("accent", e.target.value)} />
              <code>{p.accent || "auto"}</code>
            </div>
          </Field>
          <Field label="Background"><Segmented label="Background" value={p.background} onChange={(v) => set("background", v)} options={[{ value: "theme", label: "Theme" }, { value: "green", label: "Green screen" }, { value: "transparent", label: "Transparent" }]} /></Field>
          <div className="field-grid">
            <Field label="Land"><Segmented label="Land" value={p.variant} onChange={(v) => set("variant", v)} options={[{ value: "solid", label: "Solid" }, { value: "dots", label: "Dots" }]} /></Field>
            <Field label="Traveller"><Segmented label="Traveller" value={p.vehicle} onChange={(v) => set("vehicle", v)} options={[{ value: "plane", label: "Plane" }, { value: "dot", label: "Dot" }, { value: "none", label: "None" }]} /></Field>
          </div>
          <Field label="Route"><Segmented label="Route" value={p.routeStyle} onChange={(v) => set("routeStyle", v)} options={[{ value: "glow", label: "Glow" }, { value: "dashed", label: "Dashed" }, { value: "solid", label: "Solid" }, { value: "none", label: "Hidden" }]} /></Field>
          <Field label="Captions"><Segmented label="Captions" value={p.captionStyle} onChange={(v) => set("captionStyle", v)} options={[{ value: "lower-third", label: "Lower third" }, { value: "pill", label: "Pill" }, { value: "none", label: "Off" }]} /></Field>
          <div className="toggles">
            <Toggle checked={p.progress} onChange={(v) => set("progress", v)}>Progress bar</Toggle>
            <Toggle checked={p.vignette} onChange={(v) => set("vignette", v)}>Vignette</Toggle>
            <Toggle checked={p.showDistance} onChange={(v) => set("showDistance", v)}>Distance</Toggle>
          </div>
        </Panel>

        <Panel title="Text">
          <Field label="Title" htmlFor="studio-title"><input id="studio-title" value={p.title} onChange={(e) => set("title", e.target.value)} placeholder="Shown at the start" /></Field>
          <Field label="Subtitle" htmlFor="studio-subtitle"><input id="studio-subtitle" value={p.subtitle} onChange={(e) => set("subtitle", e.target.value)} placeholder="Optional" /></Field>
          <Field label="End card" htmlFor="studio-outro"><input id="studio-outro" value={p.outro} onChange={(e) => set("outro", e.target.value)} placeholder="e.g. Subscribe for part 2" /></Field>
        </Panel>

        <Panel title="Timing" hint={duration ? fmtTime(duration) : undefined}>
          <Field label="Flight between stops" htmlFor="studio-flight"><Slider id="studio-flight" value={p.flight} min={0.8} max={4} step={0.1} onChange={(v) => set("flight", v)} suffix=" s" /></Field>
          <Field label="Hold on each stop" htmlFor="studio-hold"><Slider id="studio-hold" value={p.hold} min={0.6} max={4} step={0.1} onChange={(v) => set("hold", v)} suffix=" s" /></Field>
          <Field label="Playback speed" htmlFor="studio-speed"><Slider id="studio-speed" value={p.speed} min={0.5} max={2} step={0.25} onChange={(v) => set("speed", v)} suffix="×" /></Field>
        </Panel>
      </aside>

      {/* ── status bar ── */}
      <footer className="studio__status" aria-live="polite">
        <span>{status || "Changes save automatically in this browser. Export plays the route once in real time."}</span>
        <span className="studio__meta">{fmtLabel.name} {p.aspect} · {p.resolution}p · {p.fps} fps · {stops.length} stops</span>
      </footer>
    </div>
  );
}
