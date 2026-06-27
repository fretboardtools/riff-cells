import RiffCells from "./RiffCells.jsx";

const INK = "#1a1f2e", INDIGO = "#6366f1", GOLD = "#e8a33d", MUTE = "#5b5f6e";

const wrap = { maxWidth: 720, margin: "0 auto", padding: "0 20px" };

export default function LandingPage() {
  return (
    <div>
      {/* HERO */}
      <header style={{ ...wrap, paddingTop: 56, paddingBottom: 8, textAlign: "center" }}>
        <span style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: INDIGO, fontWeight: 600 }}>
          Unlock the Guitar
        </span>
        <h1 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 40, lineHeight: 1.1, margin: "10px 0 14px" }}>
          The guitar improvisation tool that<br />never hands you the same scale twice
        </h1>
        <p style={{ fontSize: 17, color: MUTE, maxWidth: 540, margin: "0 auto 8px" }}>
          Stuck running the same two pentatonic shapes? This deals you a fresh five-note cell
          over any root and chord. Turn on the drone, and make lines you'd never have found on your own.
        </p>
      </header>

      {/* TOOL */}
      <section style={{ padding: "20px 0 8px" }}>
        <RiffCells />
      </section>

      {/* HOW TO USE */}
      <section style={{ ...wrap, paddingTop: 40 }}>
        <h2 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 26, margin: "0 0 14px" }}>
          Ten minutes, no theory homework
        </h2>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: INK }}>
          You don't need to understand why a cell works to get something musical out of it. That's the point.
          Here's the whole routine:
        </p>
        <ol style={{ fontSize: 16, lineHeight: 1.7, color: INK, paddingLeft: 20 }}>
          <li>Pick a root and a chord type — Major, Minor or Dom 7. Leave it on Dom 7 if you're not sure; it's the bluesiest.</li>
          <li>Turn the <strong>drone</strong> on so you've got something to play against.</li>
          <li>Hit <strong>Hear cell</strong> once to get the sound in your ear, then improvise over it. Use the challenge prompt if you want a nudge.</li>
          <li>When it starts feeling comfortable, hit <strong>New cell</strong> and do it again. Five minutes of this is worth an hour of mindless scale running.</li>
        </ol>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: INK }}>
          That's it. Do it daily and your ear stops reaching for the same three licks.
        </p>
      </section>

      {/* WHY IT WORKS */}
      <section style={{ ...wrap, paddingTop: 34 }}>
        <h2 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 26, margin: "0 0 14px" }}>
          Why random cells beat running scales
        </h2>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: INK }}>
          Here's the uncomfortable truth about scale practice: a scale gives you so many notes that you fall
          back on the same handful every time. Seven notes, infinite get-out clauses, and your fingers
          quietly default to the box you already know. You're not improvising — you're reciting.
        </p>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: INK }}>
          A five-note cell does the opposite. It hands you a tight little palette and forces you to be
          inventive <em>inside</em> the constraint. Fewer notes, more decisions. You have to actually phrase,
          bend, repeat and rest — the things that make a line sound like music instead of a warm-up.
        </p>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: INK }}>
          Make it random and you remove the one thing killing your creativity: choice. You stop deliberating
          over which scale and just play the cards you're dealt. Some cells sound sweet, some sound spiky —
          both teach you something the major scale never will.
        </p>
      </section>

      {/* OPT-IN */}
      <section style={{ ...wrap, paddingTop: 34, paddingBottom: 20 }}>
        <div style={{ background: "#eceaff", borderRadius: 16, padding: "28px 26px", textAlign: "center" }}>
          <h2 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 22, margin: "0 0 8px" }}>
            Want the full improv practice pack?
          </h2>
          <p style={{ fontSize: 15.5, color: MUTE, maxWidth: 460, margin: "0 auto 18px" }}>
            Get the free printable routine plus a starter set of must-know cells, straight to your inbox.
            No spam, unsubscribe any time.
          </p>

          {/* ===== PASTE YOUR EMAILOCTOPUS FORM EMBED HERE ===== */}
          {/* Replace this placeholder with the embed code from EmailOctopus → Forms → Embed. */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <input
              type="email"
              placeholder="you@email.com"
              style={{ flex: "1 1 240px", maxWidth: 300, padding: "12px 14px", borderRadius: 10,
                border: "1px solid #cfcfe0", fontSize: 15, fontFamily: "Inter, sans-serif" }}
            />
            <button
              style={{ border: "none", background: INK, color: "#fff", borderRadius: 10, padding: "12px 22px",
                fontSize: 15, fontWeight: 600, fontFamily: "Poppins, sans-serif", cursor: "pointer" }}
            >
              Send it to me
            </button>
          </div>
          {/* ================================================== */}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ ...wrap, paddingBottom: 50, textAlign: "center", color: "#9aa0b4", fontSize: 13 }}>
        © {new Date().getFullYear()} Unlock the Guitar
      </footer>
    </div>
  );
}
