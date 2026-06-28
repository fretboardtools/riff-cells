import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Volume2, VolumeX, Shuffle, Play, Lock, Crown, Square, Star, Trash2 } from "lucide-react";

/* ============================================================================
   DEV FLAG — set to false before you deploy, or all Pro features are free.
============================================================================ */
const DEV_UNLOCK_ALL = false;
const PRO_BUY_URL = "https://payhip.com/b/YOUR-PRO-PRODUCT";

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

// ---- music theory ----------------------------------------------------------
const NOTE_NAMES = ["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"];
const DEG = {0:"R",1:"♭2",2:"2",3:"♭3",4:"3",5:"4",6:"♭5",7:"5",8:"♭6",9:"6",10:"♭7",11:"7"};
const E2 = 82.41; // low E reference, pc 4

// tunings: open-string semitones above E2, high string → low string
const TUNINGS = {
  standard: { label: "Standard", pro: false, semis: [24,19,15,10,5,0]  },
  dropd:    { label: "Drop D",   pro: true,  semis: [24,19,15,10,5,-2] },
  halfstep: { label: "½-step ↓", pro: true,  semis: [23,18,14,9,4,-1]  },
  dadgad:   { label: "DADGAD",   pro: true,  semis: [22,17,15,10,5,-2] },
  openg:    { label: "Open G",   pro: true,  semis: [22,19,15,10,3,-2] },
  opend:    { label: "Open D",   pro: true,  semis: [22,17,14,10,5,-2] },
  opene:    { label: "Open E",   pro: true,  semis: [24,19,16,12,7,0]  },
  fourths:  { label: "All 4ths", pro: true,  semis: [25,20,15,10,5,0]  },
};
const tStrings = (semis) => semis.map(s => ({ semi: s, openPc: ((4 + s) % 12 + 12) % 12, name: NOTE_NAMES[((4 + s) % 12 + 12) % 12] }));

const FREE_QUALITIES = {
  maj:  { label: "Major",  required: [4, 7],  pool: [2, 9, 11, 5, 10, 3] },
  min:  { label: "Minor",  required: [3, 7],  pool: [2, 5, 10, 8, 9, 1] },
  dom7: { label: "Dom 7",  required: [4, 10], pool: [2, 5, 7, 9, 1, 3, 8, 6] },
};
const PRO_QUALITIES = {
  m7:   { label: "Min 7",  pro: true, required: [3, 10],    pool: [2, 5, 7, 8, 9] },
  maj7: { label: "Maj 7",  pro: true, required: [4, 11],    pool: [2, 9, 7, 6, 5] },
  maj6: { label: "6",      pro: true, required: [4, 9],     pool: [2, 7, 11, 5] },
  m6:   { label: "Min 6",  pro: true, required: [3, 9],     pool: [2, 5, 7, 10] },
  m7b5: { label: "m7♭5",   pro: true, required: [3, 6, 10], pool: [1, 8, 5] },
  dim7: { label: "Dim 7",  pro: true, required: [3, 6, 9],  pool: [11, 2, 5] },
  sus4: { label: "Sus 4",  pro: true, required: [5, 7],     pool: [2, 10, 9, 4] },
  sus2: { label: "Sus 2",  pro: true, required: [2, 7],     pool: [5, 10, 9, 4] },
  alt:  { label: "Altered",pro: true, required: [4, 10],    pool: [1, 3, 6, 8] },
};
const ALL_QUALITIES = { ...FREE_QUALITIES, ...PRO_QUALITIES };

const PROMPTS = [
  "Start and end your phrase on the root.",
  "Build a lick that uses every note in the shape once.",
  "Find two notes a semitone apart and resolve up into the higher one.",
  "Play it descending, then answer with the same idea ascending.",
  "Make a phrase that avoids the root, then lands on it last.",
  "Pick three notes and milk them — no need to use all five.",
  "Phrase it in triplets along a single string.",
  "Bend into one of the chord tones from a fret below.",
];

const pick = (arr, n) => {
  const c = [...arr]; const out = [];
  while (out.length < n && c.length) out.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]);
  return out;
};

function buildCell(rootPc, quality) {
  const q = ALL_QUALITIES[quality];
  const fill = pick(q.pool, 5 - 1 - q.required.length);
  const intervals = Array.from(new Set([0, ...q.required, ...fill])).sort((a,b)=>a-b);
  return { intervals, defining: new Set(q.required) };
}

// ascending fingering, tuning-aware
function makeShape(STR, rootPc, intervals, octaves) {
  let offsets = [...intervals];
  if (octaves === 2) offsets = offsets.concat(intervals.map(i => i + 12)).concat([24]);
  else offsets = offsets.concat([12]);
  const low = STR[STR.length - 1];
  let rootFret = ((rootPc - low.openPc) % 12 + 12) % 12;
  if (rootFret < 3) rootFret += 12;
  const rootAbs = low.semi + rootFret;
  const out = [];
  let si = STR.length - 1, firstOnString = null, perString = 0;
  for (const off of offsets) {
    const abs = rootAbs + off;
    while (si > 0) {
      const f = abs - STR[si].semi;
      const overStretch = firstOnString !== null && f > firstOnString + 4;
      if (perString >= 3 || overStretch) { si--; perString = 0; firstOnString = null; } else break;
    }
    const fret = abs - STR[si].semi;
    if (firstOnString === null) firstOnString = fret;
    out.push({ si, fret, pc: (rootPc + off) % 12, deg: off % 12 });
    perString++;
  }
  return out;
}

// ---- audio -----------------------------------------------------------------
function makePluck(ctx, freq, dur = 1.8) {
  const sr = ctx.sampleRate, len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len, sr), out = buf.getChannelData(0);
  const N = Math.max(2, Math.round(sr / freq)), ring = new Float32Array(N);
  let last = 0;
  for (let i = 0; i < N; i++) { const w = Math.random() * 2 - 1; last = (last + w) * 0.5; ring[i] = last; }
  let idx = 0;
  for (let i = 0; i < len; i++) { const cur = ring[idx]; ring[idx] = (cur + ring[(idx+1)%N]) * 0.5 * 0.9965; out[i] = cur; idx = (idx+1)%N; }
  for (let i = 0; i < len; i++) { const t = i / sr; out[i] *= Math.min(1, t/0.004) * Math.exp(-t*2.0) * 0.85; }
  return buf;
}
function useAudio() {
  const ref = useRef({ ctx: null, drone: [] });
  const ctx = () => {
    if (!ref.current.ctx) ref.current.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ref.current.ctx.state === "suspended") ref.current.ctx.resume();
    return ref.current.ctx;
  };
  const pluck = useCallback((freq, when = 0, gain = 1) => {
    const c = ctx(); const src = c.createBufferSource(); src.buffer = makePluck(c, freq);
    const g = c.createGain(); g.gain.value = gain;
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3800;
    src.connect(g); g.connect(lp); lp.connect(c.destination); src.start(c.currentTime + when);
  }, []);
  const click = useCallback((accent = false) => {
    const c = ctx(); const t = c.currentTime;
    const o = c.createOscillator(); const g = c.createGain();
    o.frequency.value = accent ? 1600 : 1000; o.type = "square";
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(accent ? 0.25 : 0.15, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.06);
  }, []);
  const stopDrone = useCallback(() => { ref.current.drone.forEach(n => { try { n.stop(); } catch {} }); ref.current.drone = []; }, []);
  const startDrone = useCallback((rootPc) => {
    stopDrone(); const c = ctx(); const t = c.currentTime;
    const base = 65.41 * Math.pow(2, rootPc / 12);
    const g = c.createGain(); const lp = c.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 850;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14, t + 0.5);
    g.connect(lp); lp.connect(c.destination);
    [[base,0],[base*Math.pow(2,7/12),-4],[base*2,4]].forEach(([f,det]) => {
      const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = det;
      o.connect(g); o.start(t); ref.current.drone.push(o);
    });
    ref.current.drone.push({ stop: () => { try { g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.2);} catch {} } });
  }, [stopDrone]);
  const playShape = useCallback((freqs) => { freqs.forEach((f, i) => pluck(f, i * 0.24, 0.9)); }, [pluck]);
  useEffect(() => () => { try { ref.current.ctx?.close(); } catch {} }, []);
  return { pluck, click, startDrone, stopDrone, playShape };
}

// ---- component -------------------------------------------------------------
const INK = "#1a1f2e", INDIGO = "#6366f1", GOLD = "#e8a33d", MUTE = "#8c91a3";

export default function App() {
  const [isPro, setIsPro] = useState(() => store.get("rc_pro") === "1");
  const unlocked = isPro || DEV_UNLOCK_ALL;

  const [root, setRoot] = useState(9);
  const [quality, setQuality] = useState("dom7");
  const [tuning, setTuning] = useState("standard");
  const [view, setView] = useState("shape"); // shape | roam
  const [showDeg, setShowDeg] = useState(true);
  const [octaves, setOctaves] = useState(1);
  const [cell, setCell] = useState(() => buildCell(9, "dom7"));
  const [prompt, setPrompt] = useState(PROMPTS[0]);
  const [drone, setDrone] = useState(false);

  const [bpm, setBpm] = useState(80);
  const [barsPerCell, setBarsPerCell] = useState(2);
  const [practiceOn, setPracticeOn] = useState(false);

  const [saved, setSaved] = useState(() => { try { return JSON.parse(store.get("rc_saved") || "[]"); } catch { return []; } });
  const [showFaves, setShowFaves] = useState(false);

  const [showUnlock, setShowUnlock] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [unlockMsg, setUnlockMsg] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const audio = useAudio();
  const STR = useMemo(() => tStrings(TUNINGS[tuning].semis), [tuning]);
  const noteFreq = (si, fret) => E2 * Math.pow(2, (STR[si].semi + fret) / 12);

  const shape = useMemo(() => makeShape(STR, root, cell.intervals, octaves), [STR, root, cell, octaves]);
  const pcs = useMemo(() => new Set(cell.intervals.map(iv => (root + iv) % 12)), [cell, root]);

  // build the lit notes + board window depending on view
  let lit, start, nFrets;
  if (view === "roam") {
    start = 1; nFrets = 15; lit = [];
    for (let si = 0; si < STR.length; si++) {
      for (let f = start; f < start + nFrets; f++) {
        const pc = (STR[si].openPc + f) % 12;
        if (pcs.has(pc)) lit.push({ si, fret: f, pc, deg: (pc - root + 12) % 12 });
      }
    }
  } else {
    lit = shape;
    const fr = shape.map(p => p.fret);
    const mn = Math.min(...fr), mx = Math.max(...fr);
    start = mn; nFrets = Math.max(1, mx - mn + 1);
  }
  const placed = new Map(lit.map(p => [p.si + "-" + p.fret, p]));

  const regenerate = useCallback((r = root, q = quality) => {
    setCell(buildCell(r, q)); setPrompt(PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
  }, [root, quality]);

  const genRef = useRef();
  genRef.current = () => { setCell(buildCell(root, quality)); setPrompt(PROMPTS[Math.floor(Math.random() * PROMPTS.length)]); };

  useEffect(() => { if (drone) audio.startDrone(root); else audio.stopDrone(); }, [drone, root]); // eslint-disable-line
  useEffect(() => { store.set("rc_saved", JSON.stringify(saved)); }, [saved]);

  useEffect(() => {
    if (!practiceOn || !unlocked) return;
    const beatMs = 60000 / bpm, beatsPerCell = barsPerCell * 4;
    let beat = 0; audio.click(true);
    const id = setInterval(() => { beat = (beat + 1) % beatsPerCell; if (beat === 0) genRef.current(); audio.click(beat === 0); }, beatMs);
    return () => clearInterval(id);
  }, [practiceOn, bpm, barsPerCell, unlocked]); // eslint-disable-line

  const onRoot = (pc) => { setRoot(pc); regenerate(pc, quality); };
  const onQuality = (q) => { if (ALL_QUALITIES[q].pro && !unlocked) { setShowUnlock(true); return; } setQuality(q); regenerate(root, q); };
  const onTuning = (t) => { if (TUNINGS[t].pro && !unlocked) { setShowUnlock(true); return; } setTuning(t); };
  const onView = (v) => { if (v === "roam" && !unlocked) { setShowUnlock(true); return; } setView(v); };

  const saveCell = () => {
    if (!unlocked) { setShowUnlock(true); return; }
    const entry = { root, quality, octaves, tuning, intervals: cell.intervals, ts: Date.now() };
    const sig = `${root}|${quality}|${octaves}|${tuning}|${cell.intervals.join(",")}`;
    setSaved(prev => prev.some(s => `${s.root}|${s.quality}|${s.octaves}|${s.tuning}|${s.intervals.join(",")}` === sig)
      ? prev : [entry, ...prev].slice(0, 60));
    setShowFaves(true);
  };
  const loadCell = (s) => {
    setRoot(s.root); setQuality(s.quality); setOctaves(s.octaves); setTuning(s.tuning);
    setCell({ intervals: s.intervals, defining: new Set(ALL_QUALITIES[s.quality].required) });
  };
  const delCell = (ts) => setSaved(prev => prev.filter(s => s.ts !== ts));

  const activate = async () => {
    const key = keyInput.trim();
    if (!key) { setUnlockMsg({ ok: false, text: "Enter your license key." }); return; }
    setVerifying(true); setUnlockMsg(null);
    try {
      const res = await fetch("/api/verify-license", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ license_key: key }) });
      const data = await res.json();
      if (data.valid) { setIsPro(true); store.set("rc_pro", "1"); store.set("rc_key", key); setUnlockMsg({ ok: true, text: "Pro unlocked — thank you!" }); setTimeout(() => setShowUnlock(false), 1200); }
      else setUnlockMsg({ ok: false, text: "That key wasn't recognised. Check it and try again." });
    } catch { setUnlockMsg({ ok: false, text: "Couldn't reach the licence server. Try again in a moment." }); }
    finally { setVerifying(false); }
  };

  // geometry
  const FW = Math.max(28, Math.min(92, Math.round(420 / nFrets)));
  const R  = Math.max(11, Math.min(17, Math.round(FW / 2) - 6));
  const ML = 30, MT = 26, SG = 44;
  const W = ML + nFrets * FW + 24, H = MT + 5 * SG + 46;
  const cols = Array.from({ length: nFrets }, (_, i) => i);
  const inlayFrets = [3,5,7,9,12,15,17];

  const Btn = ({ active, children, ...p }) => (
    <button {...p} style={{ cursor:"pointer", border:"1px solid", borderColor: active ? INDIGO : "#d7d8e0",
      background: active ? INDIGO : "#fff", color: active ? "#fff" : INK, borderRadius:10, padding:"7px 12px",
      fontSize:13, fontWeight:600, fontFamily:"Inter, system-ui, sans-serif", transition:"all .12s",
      display:"inline-flex", alignItems:"center", gap:5 }}>{children}</button>
  );

  return (
    <div style={{ fontFamily:"Inter, system-ui, sans-serif", color:INK, background:"#f4f4f9", padding:"22px", borderRadius:16, maxWidth:560, margin:"0 auto" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&family=Inter:wght@400;500;600&display=swap');
        button:focus-visible{outline:2px solid ${GOLD};outline-offset:2px}`}</style>

      {DEV_UNLOCK_ALL && (
        <div style={{ background:"#b91c1c", color:"#fff", fontSize:12, fontWeight:600, textAlign:"center", padding:"6px 10px", borderRadius:8, marginBottom:14 }}>
          DEV: Pro unlocked for preview — set DEV_UNLOCK_ALL = false before deploying.
        </div>
      )}

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <span style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:INDIGO, fontWeight:600 }}>Unlock the Guitar</span>
          <h1 style={{ fontFamily:"Poppins, sans-serif", fontWeight:700, fontSize:26, margin:"2px 0" }}>Riff Cells</h1>
        </div>
        {isPro
          ? <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:12, fontWeight:600, color:GOLD, background:"#fff7e9", border:`1px solid ${GOLD}`, borderRadius:20, padding:"5px 10px", height:"fit-content" }}><Crown size={14}/> Pro</span>
          : <button onClick={() => setShowUnlock(s => !s)} style={{ cursor:"pointer", display:"inline-flex", alignItems:"center", gap:5, fontSize:12.5, fontWeight:600, color:"#fff", background:GOLD, border:"none", borderRadius:20, padding:"7px 13px", height:"fit-content", fontFamily:"Inter, sans-serif" }}><Crown size={14}/> Unlock Pro</button>}
      </div>
      <p style={{ margin:"6px 0 16px", fontSize:13.5, color:"#5b5f6e", maxWidth:430 }}>
        A guitar improvisation tool that deals you a fresh five-note cell every time. Turn on the drone and make lines.
      </p>

      {showUnlock && !isPro && (
        <div style={{ background:"#fff", border:`1px solid ${GOLD}`, borderRadius:14, padding:"16px 16px 14px", marginBottom:16 }}>
          <h3 style={{ margin:"0 0 4px", fontFamily:"Poppins, sans-serif", fontSize:16 }}>Unlock Riff Cells Pro</h3>
          <p style={{ margin:"0 0 12px", fontSize:13, color:"#5b5f6e" }}>
            Practice Mode, alternate tunings, full-neck roam mode, a saved-cells library and five extra chord qualities. One-time purchase, yours for good.
          </p>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10 }}>
            <input value={keyInput} onChange={e => setKeyInput(e.target.value)} placeholder="Paste your license key"
              style={{ flex:"1 1 200px", padding:"10px 12px", borderRadius:10, border:"1px solid #d7d8e0", fontSize:14, fontFamily:"Inter, sans-serif" }} />
            <button onClick={activate} disabled={verifying} style={{ cursor:"pointer", border:"none", background:INK, color:"#fff", borderRadius:10, padding:"10px 18px", fontSize:14, fontWeight:600, fontFamily:"Poppins, sans-serif", opacity:verifying?0.6:1 }}>{verifying ? "Checking…" : "Activate"}</button>
          </div>
          {unlockMsg && <p style={{ margin:"0 0 8px", fontSize:13, color: unlockMsg.ok ? "#15803d" : "#b91c1c" }}>{unlockMsg.text}</p>}
          <a href={PRO_BUY_URL} target="_blank" rel="noreferrer" style={{ fontSize:13, fontWeight:600, color:INDIGO, textDecoration:"none" }}>Don't have a key? Get Pro →</a>
        </div>
      )}

      {/* root */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:12 }}>
        {NOTE_NAMES.map((n, pc) => (
          <button key={pc} onClick={() => onRoot(pc)} style={{ cursor:"pointer", width:34, height:34, borderRadius:9, fontSize:12.5, fontWeight:600,
            border:"1px solid", borderColor: root===pc ? GOLD : "#d7d8e0", background: root===pc ? GOLD : "#fff", color: root===pc ? INK : "#5b5f6e", fontFamily:"Inter, sans-serif" }}>{n}</button>
        ))}
      </div>

      {/* chord quality */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:10, alignItems:"center" }}>
        {Object.entries(ALL_QUALITIES).map(([k, v]) => {
          const locked = v.pro && !unlocked;
          return <Btn key={k} active={quality===k} onClick={() => onQuality(k)} title={locked ? "Pro" : undefined}>{v.label}{locked && <Lock size={12} style={{ opacity:0.7 }} />}</Btn>;
        })}
      </div>

      {/* tuning */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10, alignItems:"center" }}>
        <span style={{ fontSize:11.5, fontWeight:600, color:MUTE, marginRight:2 }}>Tuning</span>
        {Object.entries(TUNINGS).map(([k, v]) => {
          const locked = v.pro && !unlocked, active = tuning===k;
          return (
            <button key={k} onClick={() => onTuning(k)} title={locked ? "Pro" : undefined} style={{ cursor:"pointer",
              border:"1px solid", borderColor: active ? INDIGO : "#d7d8e0", background: active ? INDIGO : "#fff",
              color: active ? "#fff" : INK, borderRadius:9, padding:"5px 10px", fontSize:12, fontWeight:600,
              fontFamily:"Inter, sans-serif", display:"inline-flex", alignItems:"center", gap:4 }}>
              {v.label}{locked && <Lock size={11} style={{ opacity:0.7 }} />}
            </button>
          );
        })}
      </div>

      {/* view + octave + labels */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:16, alignItems:"center" }}>
        <div style={{ display:"flex", gap:4, background:"#e7e8f0", borderRadius:10, padding:3 }}>
          {[["shape","Shape"],["roam","Roam"]].map(([v,lab]) => {
            const locked = v==="roam" && !unlocked;
            return <button key={v} onClick={() => onView(v)} style={{ cursor:"pointer", border:"none", borderRadius:8, padding:"6px 12px", fontSize:13, fontWeight:600,
              background: view===v ? "#fff" : "transparent", color: view===v ? INK : "#7b7f8e", boxShadow: view===v ? "0 1px 2px rgba(0,0,0,.12)" : "none",
              fontFamily:"Inter, sans-serif", display:"inline-flex", alignItems:"center", gap:4 }}>{lab}{locked && <Lock size={11} style={{ opacity:0.6 }}/>}</button>;
          })}
        </div>
        {view==="shape" && (
          <div style={{ display:"flex", gap:4, background:"#e7e8f0", borderRadius:10, padding:3 }}>
            {[[1,"1 oct"],[2,"2 oct"]].map(([o,lab]) => (
              <button key={o} onClick={() => setOctaves(o)} style={{ cursor:"pointer", border:"none", borderRadius:8, padding:"6px 12px", fontSize:13, fontWeight:600,
                background: octaves===o ? "#fff" : "transparent", color: octaves===o ? INK : "#7b7f8e", boxShadow: octaves===o ? "0 1px 2px rgba(0,0,0,.12)" : "none", fontFamily:"Inter, sans-serif" }}>{lab}</button>
            ))}
          </div>
        )}
        <span style={{ flex:1 }} />
        <Btn active={showDeg} onClick={() => setShowDeg(!showDeg)}>{showDeg ? "Degrees" : "Notes"}</Btn>
      </div>

      {/* fretboard */}
      <div style={{ background:"#fff", borderRadius:14, padding:"6px 4px 2px", boxShadow:"0 1px 3px rgba(26,31,46,.08)", overflowX:"auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", minWidth: view==="roam" ? 460 : "auto", height:"auto", display:"block" }}>
          <rect x={ML} y={MT-6} width={nFrets*FW} height={5*SG+12} rx={6} fill={INK} />
          {Array.from({length:nFrets+1},(_,i)=>i).map(i => <line key={i} x1={ML+i*FW} y1={MT-6} x2={ML+i*FW} y2={MT+5*SG+6} stroke="#3a4156" strokeWidth={2} />)}
          {cols.map(col => {
            const fret = start + col; if (!inlayFrets.includes(fret)) return null;
            const x = ML + col*FW + FW/2; const dots = (fret % 12 === 0) ? [MT+1.5*SG, MT+3.5*SG] : [MT+2.5*SG];
            return dots.map((y,j) => <circle key={col+"-"+j} cx={x} cy={y} r={4} fill="#2c3247" />);
          })}
          {STR.map((s, si) => { const y = MT + si*SG; return (
            <g key={si}>
              <line x1={ML} y1={y} x2={ML+nFrets*FW} y2={y} stroke="#9aa0b4" strokeWidth={0.8 + si*0.35} />
              <text x={ML-12} y={y+4} fontSize={12} fill={MUTE} textAnchor="middle" fontFamily="Inter">{s.name}</text>
            </g>); })}
          {STR.map((s, si) => cols.map(col => {
            const fret = start + col; const p = placed.get(si + "-" + fret); if (!p) return null;
            const x = ML + col*FW + FW/2, y = MT + si*SG;
            const isRoot = p.deg === 0, isDef = cell.defining.has(p.deg);
            const label = showDeg ? DEG[p.deg] : NOTE_NAMES[p.pc];
            return (
              <g key={si+"-"+col} style={{ cursor:"pointer" }} onClick={() => audio.pluck(noteFreq(si, fret))}>
                <circle cx={x} cy={y} r={R} fill={isRoot ? GOLD : INDIGO} stroke={isDef && !isRoot ? GOLD : "transparent"} strokeWidth={isDef && !isRoot ? 2.5 : 0} />
                <text x={x} y={y+4.5} fontSize={Math.min(13,R-2)} fontWeight={700} fill={isRoot ? INK : "#fff"} textAnchor="middle" fontFamily="Inter" style={{ pointerEvents:"none" }}>{label}</text>
              </g>);
          }))}
          {cols.map(col => <text key={col} x={ML+col*FW+FW/2} y={MT+5*SG+26} fontSize={12} fill={MUTE} textAnchor="middle" fontFamily="Inter">{start+col}</text>)}
        </svg>
      </div>

      {/* cell summary */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, alignItems:"center", margin:"14px 0 4px" }}>
        {cell.intervals.map(iv => {
          const isRoot = iv===0, isDef = cell.defining.has(iv);
          return <span key={iv} style={{ fontSize:12.5, fontWeight:600, padding:"4px 9px", borderRadius:20,
            background: isRoot ? GOLD : "#eceaff", color: isRoot ? INK : INDIGO, border: isDef && !isRoot ? `1.5px solid ${GOLD}` : "1.5px solid transparent" }}>{DEG[iv]} · {NOTE_NAMES[(root+iv)%12]}</span>;
        })}
      </div>
      <p style={{ fontSize:11.5, color:MUTE, margin:"0 0 14px" }}>
        Gold = root. Gold-ringed = the notes that make it sound {ALL_QUALITIES[quality].label.toLowerCase()}.
        {view==="roam" ? " Roam shows every place these notes live across the neck." : " Tap any note to hear it."}
      </p>

      {/* controls */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        <button onClick={() => regenerate()} style={{ cursor:"pointer", flex:"1 1 140px", border:"none", background:INK, color:"#fff", borderRadius:11, padding:"12px", fontSize:14.5, fontWeight:600, fontFamily:"Poppins, sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}><Shuffle size={17} /> New cell</button>
        <button onClick={() => setDrone(d => !d)} style={{ cursor:"pointer", border:"1px solid", borderColor: drone ? INDIGO : "#d7d8e0", background: drone ? INDIGO : "#fff", color: drone ? "#fff" : INK, borderRadius:11, padding:"12px 16px", fontSize:14, fontWeight:600, display:"flex", alignItems:"center", gap:7 }}>{drone ? <Volume2 size={17}/> : <VolumeX size={17}/>} Drone</button>
        <button onClick={() => audio.playShape(shape.map(p => noteFreq(p.si, p.fret)))} style={{ cursor:"pointer", border:"1px solid #d7d8e0", background:"#fff", color:INK, borderRadius:11, padding:"12px 16px", fontSize:14, fontWeight:600, display:"flex", alignItems:"center", gap:7 }}><Play size={16}/> Hear</button>
        <button onClick={saveCell} title="Save cell" style={{ cursor:"pointer", border:"1px solid #d7d8e0", background:"#fff", color:INK, borderRadius:11, padding:"12px 14px", fontSize:14, fontWeight:600, display:"flex", alignItems:"center", gap:6 }}><Star size={16}/>{!unlocked && <Lock size={12} style={{opacity:.6}}/>}</button>
      </div>

      {/* favourites */}
      {unlocked && saved.length > 0 && (
        <div style={{ marginTop:12 }}>
          <button onClick={() => setShowFaves(f => !f)} style={{ cursor:"pointer", border:"none", background:"none", color:INDIGO, fontSize:13, fontWeight:600, padding:0, display:"inline-flex", alignItems:"center", gap:5 }}>
            <Star size={14}/> Saved cells ({saved.length}) {showFaves ? "▲" : "▼"}
          </button>
          {showFaves && (
            <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:8 }}>
              {saved.map(s => (
                <div key={s.ts} style={{ display:"flex", alignItems:"center", gap:8, background:"#fff", borderRadius:9, padding:"8px 10px", boxShadow:"0 1px 2px rgba(26,31,46,.06)" }}>
                  <button onClick={() => loadCell(s)} style={{ cursor:"pointer", border:"none", background:"none", textAlign:"left", flex:1, fontSize:13, color:INK, fontFamily:"Inter, sans-serif" }}>
                    <strong>{NOTE_NAMES[s.root]} {ALL_QUALITIES[s.quality].label}</strong>
                    <span style={{ color:MUTE }}> · {TUNINGS[s.tuning].label} · {s.intervals.map(iv => DEG[iv]).join(" ")}</span>
                  </button>
                  <button onClick={() => delCell(s.ts)} title="Remove" style={{ cursor:"pointer", border:"none", background:"none", color:MUTE, padding:2, display:"flex" }}><Trash2 size={15}/></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* practice mode */}
      <div style={{ marginTop:14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
          <h3 style={{ margin:0, fontFamily:"Poppins, sans-serif", fontSize:15 }}>Practice Mode</h3>
          {!unlocked && <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:11, fontWeight:600, color:GOLD, background:"#fff7e9", border:`1px solid ${GOLD}`, borderRadius:20, padding:"2px 8px" }}><Crown size={11}/> Pro</span>}
        </div>
        {unlocked ? (
          <div style={{ background:"#fff", borderRadius:12, padding:"14px 16px", boxShadow:"0 1px 3px rgba(26,31,46,.08)" }}>
            <p style={{ margin:"0 0 12px", fontSize:13, color:"#5b5f6e" }}>Hands-free: a click keeps time and a fresh cell appears every few bars. Start it, pick up the guitar, and play.</p>
            <div style={{ display:"flex", gap:18, flexWrap:"wrap", alignItems:"center", marginBottom:14 }}>
              <label style={{ fontSize:13, fontWeight:600 }}>Tempo: {bpm} BPM
                <input type="range" min={50} max={160} value={bpm} onChange={e => setBpm(+e.target.value)} style={{ display:"block", width:180, marginTop:4, accentColor:INDIGO }} /></label>
              <label style={{ fontSize:13, fontWeight:600 }}>New cell every
                <select value={barsPerCell} onChange={e => setBarsPerCell(+e.target.value)} style={{ display:"block", marginTop:4, padding:"6px 8px", borderRadius:8, border:"1px solid #d7d8e0", fontSize:13 }}>
                  <option value={1}>1 bar</option><option value={2}>2 bars</option><option value={4}>4 bars</option><option value={8}>8 bars</option></select></label>
            </div>
            <button onClick={() => setPracticeOn(p => !p)} style={{ cursor:"pointer", border:"none", background: practiceOn ? "#b91c1c" : INDIGO, color:"#fff", borderRadius:11, padding:"11px 20px", fontSize:14, fontWeight:600, fontFamily:"Poppins, sans-serif", display:"inline-flex", alignItems:"center", gap:7 }}>{practiceOn ? <><Square size={15}/> Stop</> : <><Play size={15}/> Start practice</>}</button>
          </div>
        ) : (
          <div style={{ background:"#fff", borderRadius:12, padding:"16px", boxShadow:"0 1px 3px rgba(26,31,46,.08)", textAlign:"center" }}>
            <p style={{ margin:"0 0 12px", fontSize:13.5, color:"#5b5f6e" }}>Set a tempo and let cells auto-advance while a click keeps time — a hands-free practice companion for your music stand.</p>
            <button onClick={() => setShowUnlock(true)} style={{ cursor:"pointer", border:"none", background:GOLD, color:INK, borderRadius:11, padding:"10px 18px", fontSize:14, fontWeight:600, fontFamily:"Poppins, sans-serif", display:"inline-flex", alignItems:"center", gap:6 }}><Crown size={15}/> Unlock with Pro</button>
          </div>
        )}
      </div>

      {/* prompt */}
      <div style={{ marginTop:14, background:"#eceaff", borderRadius:11, padding:"12px 14px", borderLeft:`4px solid ${INDIGO}` }}>
        <div style={{ fontSize:10.5, letterSpacing:1.5, textTransform:"uppercase", color:INDIGO, fontWeight:600, marginBottom:3 }}>Your challenge</div>
        <div style={{ fontSize:14, color:INK }}>{prompt}</div>
      </div>
    </div>
  );
}
