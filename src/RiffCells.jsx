import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Volume2, VolumeX, Shuffle, Play } from "lucide-react";

// ---- music theory ----------------------------------------------------------
const NOTE_NAMES = ["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"];
const DEG = {0:"R",1:"♭2",2:"2",3:"♭3",4:"3",5:"4",6:"♭5",7:"5",8:"♭6",9:"6",10:"♭7",11:"7"};

// strings high→low (top→bottom). semis = pitch above low E. open freqs in Hz.
const STRINGS = [
  { name: "e", openPc: 4,  openFreq: 329.63, semi: 24 },
  { name: "B", openPc: 11, openFreq: 246.94, semi: 19 },
  { name: "G", openPc: 7,  openFreq: 196.00, semi: 15 },
  { name: "D", openPc: 2,  openFreq: 146.83, semi: 10 },
  { name: "A", openPc: 9,  openFreq: 110.00, semi: 5  },
  { name: "E", openPc: 4,  openFreq: 82.41,  semi: 0  },
];

const QUALITIES = {
  maj:  { label: "Major",  required: [4, 7],  pool: [2, 9, 11, 5, 10, 3] },
  min:  { label: "Minor",  required: [3, 7],  pool: [2, 5, 10, 8, 9, 1] },
  dom7: { label: "Dom 7",  required: [4, 10], pool: [2, 5, 7, 9, 1, 3, 8, 6] },
};

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
  const c = [...arr];
  const out = [];
  while (out.length < n && c.length) out.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]);
  return out;
};

function buildCell(rootPc, quality, chaos) {
  const q = QUALITIES[quality];
  const required = chaos ? [] : q.required;
  const pool = chaos ? [1,2,3,4,5,6,7,8,9,10,11] : q.pool;
  const fill = pick(pool, 5 - 1 - required.length);
  const intervals = Array.from(new Set([0, ...required, ...fill])).sort((a,b)=>a-b);
  return { intervals, defining: new Set(required) };
}

// Build an ascending fingering: 5 notes (1 oct) or 10 notes (2 oct).
function makeShape(rootPc, intervals, octaves) {
  let offsets = [...intervals];
  if (octaves === 2) offsets = offsets.concat(intervals.map(i => i + 12)).concat([24]);
  else offsets = offsets.concat([12]);
  let startFret = ((rootPc - 4) % 12 + 12) % 12;   // root on low E
  if (startFret < 3) startFret += 12;              // sit it mid-neck, 3..14
  const out = [];
  let si = 5, firstOnString = null, perString = 0;
  for (const off of offsets) {
    const abs = startFret + off;
    while (si > 0) {
      const f = abs - STRINGS[si].semi;
      const overStretch = firstOnString !== null && f > firstOnString + 4;
      if (perString >= 3 || overStretch) { si--; perString = 0; firstOnString = null; }
      else break;
    }
    const fret = abs - STRINGS[si].semi;
    if (firstOnString === null) firstOnString = fret;
    out.push({ si, fret, pc: (rootPc + off) % 12, deg: off % 12 });
    perString++;
  }
  return out;
}

// ---- audio: Karplus-Strong plucked string ----------------------------------
function makePluck(ctx, freq, dur = 1.8) {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);
  const N = Math.max(2, Math.round(sr / freq));
  const ring = new Float32Array(N);
  let last = 0;
  for (let i = 0; i < N; i++) { const w = Math.random() * 2 - 1; last = (last + w) * 0.5; ring[i] = last; }
  const decay = 0.9965;
  let idx = 0;
  for (let i = 0; i < len; i++) {
    const cur = ring[idx];
    ring[idx] = (cur + ring[(idx + 1) % N]) * 0.5 * decay;
    out[i] = cur; idx = (idx + 1) % N;
  }
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    out[i] *= Math.min(1, t / 0.004) * Math.exp(-t * 2.0) * 0.85;
  }
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
    const c = ctx();
    const src = c.createBufferSource(); src.buffer = makePluck(c, freq);
    const g = c.createGain(); g.gain.value = gain;
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3800;
    src.connect(g); g.connect(lp); lp.connect(c.destination);
    src.start(c.currentTime + when);
  }, []);
  const stopDrone = useCallback(() => {
    ref.current.drone.forEach(n => { try { n.stop(); } catch {} });
    ref.current.drone = [];
  }, []);
  const startDrone = useCallback((rootPc) => {
    stopDrone();
    const c = ctx(); const t = c.currentTime;
    const base = 65.41 * Math.pow(2, rootPc / 12);
    const g = c.createGain(); const lp = c.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 850;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14, t + 0.5);
    g.connect(lp); lp.connect(c.destination);
    [[base,0],[base*Math.pow(2,7/12),-4],[base*2,4]].forEach(([f,det]) => {
      const o = c.createOscillator();
      o.type = "sawtooth"; o.frequency.value = f; o.detune.value = det;
      o.connect(g); o.start(t); ref.current.drone.push(o);
    });
    ref.current.drone.push({ stop: () => { try { g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.2);} catch {} } });
  }, [stopDrone]);
  const playShape = useCallback((freqs) => {
    freqs.forEach((f, i) => pluck(f, i * 0.24, 0.9));
  }, [pluck]);
  useEffect(() => () => { try { ref.current.ctx?.close(); } catch {} }, []);
  return { pluck, startDrone, stopDrone, playShape };
}

// ---- component -------------------------------------------------------------
const INK = "#1a1f2e", INDIGO = "#6366f1", GOLD = "#e8a33d";

export default function RiffCells() {
  const [root, setRoot] = useState(9);
  const [quality, setQuality] = useState("dom7");
  const [chaos, setChaos] = useState(false);
  const [showDeg, setShowDeg] = useState(true);
  const [octaves, setOctaves] = useState(1);
  const [cell, setCell] = useState(() => buildCell(9, "dom7", false));
  const [prompt, setPrompt] = useState(PROMPTS[0]);
  const [drone, setDrone] = useState(false);
  const audio = useAudio();

  const shape = useMemo(() => makeShape(root, cell.intervals, octaves), [root, cell, octaves]);
  const frets = shape.map(p => p.fret);
  const minFret = Math.min(...frets), maxFret = Math.max(...frets);
  const start = minFret, nFrets = Math.max(1, maxFret - minFret + 1);
  const placed = new Map(shape.map(p => [p.si + "-" + p.fret, p]));

  const regenerate = useCallback((r = root, q = quality, ch = chaos) => {
    setCell(buildCell(r, q, ch));
    setPrompt(PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
  }, [root, quality, chaos]);

  useEffect(() => { if (drone) audio.startDrone(root); else audio.stopDrone(); }, [drone, root]); // eslint-disable-line

  const onRoot = (pc) => { setRoot(pc); regenerate(pc, quality, chaos); };
  const onQuality = (q) => { setQuality(q); regenerate(root, q, chaos); };
  const onChaos = () => { const v = !chaos; setChaos(v); regenerate(root, quality, v); };

  // geometry (scales to span)
  const FW = Math.max(40, Math.min(92, Math.round(360 / nFrets)));
  const R  = Math.max(12, Math.min(17, Math.round(FW / 2) - 6));
  const ML = 30, MT = 26, SG = 44;
  const W = ML + nFrets * FW + 24, H = MT + 5 * SG + 46;
  const cols = Array.from({ length: nFrets }, (_, i) => i);
  const inlayFrets = [3,5,7,9,12,15,17];

  const noteFreq = (si, fret) => STRINGS[si].openFreq * Math.pow(2, fret / 12);

  const Btn = ({ active, children, ...p }) => (
    <button {...p} style={{
      cursor:"pointer", border:"1px solid", borderColor: active ? INDIGO : "#d7d8e0",
      background: active ? INDIGO : "#fff", color: active ? "#fff" : INK,
      borderRadius:10, padding:"7px 12px", fontSize:13, fontWeight:600,
      fontFamily:"Inter, system-ui, sans-serif", transition:"all .12s",
    }}>{children}</button>
  );

  return (
    <div style={{ fontFamily:"Inter, system-ui, sans-serif", color:INK, background:"#f4f4f9",
      padding:"22px", borderRadius:16, maxWidth:560, margin:"0 auto" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&family=Inter:wght@400;500;600&display=swap');
        button:focus-visible{outline:2px solid ${GOLD};outline-offset:2px}`}</style>

      <span style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:INDIGO, fontWeight:600 }}>Unlock the Guitar</span>
      <h1 style={{ fontFamily:"Poppins, sans-serif", fontWeight:700, fontSize:26, margin:"2px 0" }}>Riff Cells</h1>
      <p style={{ margin:"0 0 16px", fontSize:13.5, color:"#5b5f6e", maxWidth:430 }}>
        A guitar improvisation tool that deals you a fresh five-note cell every time. Turn on the drone and make lines.
      </p>

      {/* root selector */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:12 }}>
        {NOTE_NAMES.map((n, pc) => (
          <button key={pc} onClick={() => onRoot(pc)} style={{
            cursor:"pointer", width:34, height:34, borderRadius:9, fontSize:12.5, fontWeight:600,
            border:"1px solid", borderColor: root===pc ? GOLD : "#d7d8e0",
            background: root===pc ? GOLD : "#fff", color: root===pc ? INK : "#5b5f6e",
            fontFamily:"Inter, sans-serif",
          }}>{n}</button>
        ))}
      </div>

      {/* quality + chaos */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:10, alignItems:"center" }}>
        {Object.entries(QUALITIES).map(([k, v]) => (
          <Btn key={k} active={quality===k && !chaos} onClick={() => onQuality(k)}>{v.label}</Btn>
        ))}
        <Btn active={chaos} onClick={onChaos}>Chaos</Btn>
      </div>

      {/* octaves + label toggle */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:16, alignItems:"center" }}>
        <div style={{ display:"flex", gap:4, background:"#e7e8f0", borderRadius:10, padding:3 }}>
          {[[1,"1 oct"],[2,"2 oct"]].map(([o,lab]) => (
            <button key={o} onClick={() => setOctaves(o)} style={{
              cursor:"pointer", border:"none", borderRadius:8, padding:"6px 13px", fontSize:13, fontWeight:600,
              background: octaves===o ? "#fff" : "transparent", color: octaves===o ? INK : "#7b7f8e",
              boxShadow: octaves===o ? "0 1px 2px rgba(0,0,0,.12)" : "none", fontFamily:"Inter, sans-serif",
            }}>{lab}</button>
          ))}
        </div>
        <span style={{ fontSize:11.5, color:"#8c91a3" }}>{shape.length} notes</span>
        <span style={{ flex:1 }} />
        <Btn active={showDeg} onClick={() => setShowDeg(!showDeg)}>{showDeg ? "Degrees" : "Notes"}</Btn>
      </div>

      {/* fretboard */}
      <div style={{ background:"#fff", borderRadius:14, padding:"6px 4px 2px", boxShadow:"0 1px 3px rgba(26,31,46,.08)" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto", display:"block" }}>
          <rect x={ML} y={MT-6} width={nFrets*FW} height={5*SG+12} rx={6} fill={INK} />
          {Array.from({length:nFrets+1},(_,i)=>i).map(i => (
            <line key={i} x1={ML+i*FW} y1={MT-6} x2={ML+i*FW} y2={MT+5*SG+6}
              stroke="#3a4156" strokeWidth={2} />
          ))}
          {cols.map(col => {
            const fret = start + col;
            if (!inlayFrets.includes(fret)) return null;
            const x = ML + col*FW + FW/2;
            const dots = (fret % 12 === 0) ? [MT+1.5*SG, MT+3.5*SG] : [MT+2.5*SG];
            return dots.map((y,j) => <circle key={col+"-"+j} cx={x} cy={y} r={4} fill="#2c3247" />);
          })}
          {STRINGS.map((s, si) => {
            const y = MT + si*SG;
            return (
              <g key={si}>
                <line x1={ML} y1={y} x2={ML+nFrets*FW} y2={y} stroke="#9aa0b4" strokeWidth={0.8 + si*0.35} />
                <text x={ML-12} y={y+4} fontSize={12} fill="#8c91a3" textAnchor="middle" fontFamily="Inter">{s.name}</text>
              </g>
            );
          })}
          {STRINGS.map((s, si) =>
            cols.map(col => {
              const fret = start + col;
              const p = placed.get(si + "-" + fret);
              if (!p) return null;
              const x = ML + col*FW + FW/2, y = MT + si*SG;
              const isRoot = p.deg === 0;
              const isDef = cell.defining.has(p.deg);
              const label = showDeg ? DEG[p.deg] : NOTE_NAMES[p.pc];
              return (
                <g key={si+"-"+col} style={{ cursor:"pointer" }} onClick={() => audio.pluck(noteFreq(si, fret))}>
                  <circle cx={x} cy={y} r={R} fill={isRoot ? GOLD : INDIGO}
                    stroke={isDef && !isRoot ? GOLD : "transparent"} strokeWidth={isDef && !isRoot ? 2.5 : 0} />
                  <text x={x} y={y+4.5} fontSize={Math.min(13,R-2)} fontWeight={700} fill={isRoot ? INK : "#fff"}
                    textAnchor="middle" fontFamily="Inter" style={{ pointerEvents:"none" }}>{label}</text>
                </g>
              );
            })
          )}
          {cols.map(col => (
            <text key={col} x={ML+col*FW+FW/2} y={MT+5*SG+26} fontSize={12} fill="#8c91a3"
              textAnchor="middle" fontFamily="Inter">{start+col}</text>
          ))}
        </svg>
      </div>

      {/* cell summary */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, alignItems:"center", margin:"14px 0 4px" }}>
        {cell.intervals.map(iv => {
          const isRoot = iv===0, isDef = cell.defining.has(iv);
          return (
            <span key={iv} style={{
              fontSize:12.5, fontWeight:600, padding:"4px 9px", borderRadius:20,
              background: isRoot ? GOLD : "#eceaff", color: isRoot ? INK : INDIGO,
              border: isDef && !isRoot ? `1.5px solid ${GOLD}` : "1.5px solid transparent",
            }}>{DEG[iv]} · {NOTE_NAMES[(root+iv)%12]}</span>
          );
        })}
      </div>
      <p style={{ fontSize:11.5, color:"#8c91a3", margin:"0 0 14px" }}>
        Gold = root. Gold-ringed = the notes that make it sound {chaos ? "however it sounds" : QUALITIES[quality].label.toLowerCase()}. Tap any note to hear it.
      </p>

      {/* controls */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        <button onClick={() => regenerate()} style={{
          cursor:"pointer", flex:"1 1 150px", border:"none", background:INK, color:"#fff",
          borderRadius:11, padding:"12px", fontSize:14.5, fontWeight:600, fontFamily:"Poppins, sans-serif",
          display:"flex", alignItems:"center", justifyContent:"center", gap:7,
        }}><Shuffle size={17} /> New cell</button>
        <button onClick={() => setDrone(d => !d)} style={{
          cursor:"pointer", border:"1px solid", borderColor: drone ? INDIGO : "#d7d8e0",
          background: drone ? INDIGO : "#fff", color: drone ? "#fff" : INK,
          borderRadius:11, padding:"12px 16px", fontSize:14, fontWeight:600,
          display:"flex", alignItems:"center", gap:7,
        }}>{drone ? <Volume2 size={17}/> : <VolumeX size={17}/>} Drone</button>
        <button onClick={() => audio.playShape(shape.map(p => noteFreq(p.si, p.fret)))} style={{
          cursor:"pointer", border:"1px solid #d7d8e0", background:"#fff", color:INK,
          borderRadius:11, padding:"12px 16px", fontSize:14, fontWeight:600,
          display:"flex", alignItems:"center", gap:7,
        }}><Play size={16}/> Hear cell</button>
      </div>

      {/* prompt */}
      <div style={{ marginTop:14, background:"#eceaff", borderRadius:11, padding:"12px 14px", borderLeft:`4px solid ${INDIGO}` }}>
        <div style={{ fontSize:10.5, letterSpacing:1.5, textTransform:"uppercase", color:INDIGO, fontWeight:600, marginBottom:3 }}>Your challenge</div>
        <div style={{ fontSize:14, color:INK }}>{prompt}</div>
      </div>
    </div>
  );
}
