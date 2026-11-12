import React from "react";
import { AbsoluteFill, Audio, Easing, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Card, Check, clamp, Eyebrow, Face, Fill, Mark, NetLogo, Shield, useEnter, Wordmark, Words } from "./kit";
import { BODY, C, DISPLAY } from "./theme";

// Bursr's launch film (1920×1080, 30 fps). Ten scenes that cross-fade:
// the problem, the reveal, then everything Bursr does, then the call to action.

const OVERLAP = 12;
const SCENES: { len: number; C: React.FC<{ len: number }> }[] = [
  { len: 150, C: ColdOpen },
  { len: 250, C: Problem },
  { len: 130, C: Reveal },
  { len: 390, C: Payday },
  { len: 220, C: Networks },
  { len: 280, C: Invoices },
  { len: 250, C: TalkToIt },
  { len: 280, C: Limits },
  { len: 250, C: Everything },
  { len: 280, C: EndCard },
];
export const LAUNCH_FRAMES = SCENES.reduce((s, x) => s + x.len, 0) - OVERLAP * (SCENES.length - 1);

export const Launch: React.FC = () => {
  let from = 0;
  return (
    <AbsoluteFill style={{ background: C.navy }}>
      {/* "Infinity" by Arulo, Mixkit Stock Music Free License (commercial use, no attribution required). */}
      <Audio src={staticFile("music.mp3")} volume={(f) => interpolate(f, [0, 30, LAUNCH_FRAMES - 75, LAUNCH_FRAMES], [0, 0.85, 0.85, 0], clamp)} />
      {SCENES.map(({ len, C: Scene }, i) => {
        const start = from;
        from += len - OVERLAP;
        return (
          <Sequence key={i} from={start} durationInFrames={len}>
            <Fade len={len}>
              <Scene len={len} />
            </Fade>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

function Fade({ len, children }: { len: number; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, OVERLAP, len - OVERLAP, len], [0, 1, 1, 0], clamp);
  const scale = interpolate(frame, [len - OVERLAP, len], [1, 1.03], clamp);
  return <AbsoluteFill style={{ opacity, transform: `scale(${scale})` }}>{children}</AbsoluteFill>;
}

const Center: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", ...style }}>{children}</AbsoluteFill>
);

/* 1. Cold open --------------------------------------------------------------- */
function ColdOpen() {
  return (
    <Fill color={C.navy}>
      <Center style={{ padding: 160, alignItems: "flex-start" }}>
        <Words text="Every Friday, a business pays its people." size={104} color={C.card} delay={8} />
        <div style={{ height: 36 }} />
        <Words text="Most just hope it's the right ones." size={104} color={C.accent} delay={58} highlight={["hope"]} highlightColor={C.lilac} />
      </Center>
    </Fill>
  );
}

/* 2. The problem ------------------------------------------------------------- */
const TRICKS = [
  { title: "Ek0 Fresh Foods", line: "Invoice #EFF-7781 · $285.00", stamp: "Look-alike name", x: -540, rot: -4 },
  { title: "NOTICE: our bank details have changed", line: "Pay ONLY the new account. Pay today.", stamp: "New account?", x: 540, rot: 3 },
  { title: "Mama Put Farms · #MPF-0412", line: "Sent again on Wednesday · $118.00", stamp: "Paid already", x: -540, rot: 2 },
  { title: "Tomatoes (crate) × 4", line: "$23.40 each · you agreed $18.00", stamp: "+30%", x: 540, rot: -3 },
];

function Problem() {
  const frame = useCurrentFrame();
  return (
    <Fill color={C.paper}>
      <div style={{ position: "absolute", top: 110, left: 160, right: 160 }}>
        <Eyebrow delay={4} color={C.refuse}>
          The costliest mistakes don&apos;t look like mistakes
        </Eyebrow>
        <div style={{ height: 18 }} />
        <Words text="One wrong payment can cost a month's profit." size={78} delay={10} stagger={3} />
      </div>
      <div style={{ position: "absolute", top: 450, left: 160, right: 160, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "70px 36px" }}>
        {TRICKS.map((t, i) => {
          const d = 40 + i * 16;
          const k = interpolate(frame, [d, d + 18], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
          const stamp = interpolate(frame, [d + 46, d + 54], [2.2, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
          const stampOp = interpolate(frame, [d + 46, d + 50], [0, 1], clamp);
          return (
            <div key={i} style={{ position: "relative", transform: `translateX(${(1 - k) * t.x}px) rotate(${t.rot * k}deg)`, opacity: k }}>
              <Card style={{ padding: 36 }}>
                <div style={{ fontSize: 32, fontWeight: 700 }}>{t.title}</div>
                <div style={{ marginTop: 10, fontSize: 26, color: C.muted }}>{t.line}</div>
              </Card>
              <div
                style={{
                  position: "absolute",
                  right: 24,
                  top: -44,
                  opacity: stampOp,
                  transform: `scale(${stamp}) rotate(-8deg)`,
                  border: `4px solid ${C.refuse}`,
                  color: C.refuse,
                  background: "rgba(254,228,226,0.92)",
                  borderRadius: 14,
                  padding: "8px 18px",
                  fontFamily: DISPLAY,
                  fontWeight: 800,
                  fontSize: 30,
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                }}
              >
                {t.stamp}
              </div>
            </div>
          );
        })}
      </div>
    </Fill>
  );
}

/* 3. The reveal -------------------------------------------------------------- */
function Reveal() {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [6, 56], [0, 1], clamp);
  const word = useEnter(44);
  const tag = useEnter(66);
  return (
    <Fill color={C.navy}>
      <Center>
        <div style={{ display: "flex", alignItems: "center", gap: 44 }}>
          <Mark size={260} progress={p} reversed />
          <div style={{ opacity: word, transform: `translateX(${(1 - word) * -40}px)` }}>
            <Wordmark size={210} color={C.card} />
          </div>
        </div>
        <div style={{ marginTop: 44, fontFamily: DISPLAY, fontWeight: 700, fontSize: 56, color: C.accent, letterSpacing: "-0.03em", opacity: tag, transform: `translateY(${(1 - tag) * 20}px)` }}>
          Your AI payroll agent.
        </div>
      </Center>
    </Fill>
  );
}

/* 4. Payday on autopilot ----------------------------------------------------- */
const PEOPLE = [
  { name: "Bisi Adeyemi", role: "Head chef", amount: 220, net: "base", netName: "Base", token: "USDC", photo: "photos/chef-abuja.jpg", focus: "53% 14%" },
  { name: "Mama Put Farms", role: "Tomatoes & pepper", amount: 118, net: "near", netName: "NEAR", token: "USDC", photo: "photos/tomatoes-ibadan.jpg", focus: "44% 44%" },
  { name: "Tunde Okafor", role: "Grill cook", amount: 110, net: "tron", netName: "Tron", token: "USDT", photo: "photos/jollof-lagos.jpg", focus: "57% 24%" },
  { name: "Amaka Eze", role: "Cashier", amount: 120, net: "solana", netName: "Solana", token: "USDC", photo: "photos/vendor-phone.jpg", focus: "55% 32%" },
];
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Payday() {
  const frame = useCurrentFrame();
  const phone = useEnter(10, 16);
  const paidAt = (i: number) => 90 + i * 42;
  const spent = PEOPLE.reduce((s, p, i) => s + (frame >= paidAt(i) ? p.amount : 0), 0);
  const spots = [
    { left: 800, top: 140 },
    { left: 1540, top: 300 },
    { left: 800, top: 660 },
    { left: 1540, top: 780 },
  ];
  return (
    <Fill color={C.paper}>
      <div style={{ position: "absolute", left: 120, top: 280, width: 640 }}>
        <Eyebrow delay={4}>Payday on autopilot</Eyebrow>
        <div style={{ height: 20 }} />
        <Words text="Your agent pays everyone, on their day." size={76} delay={10} stagger={3} highlight={["everyone"]} />
        <div style={{ marginTop: 34, fontFamily: BODY, fontSize: 34, lineHeight: 1.4, color: C.muted, opacity: useEnter(40) }}>
          Weekly, every two weeks or monthly. In digital dollars. You don&apos;t press a thing.
        </div>
      </div>
      {/* Phone */}
      <div
        style={{
          position: "absolute",
          left: 1090,
          top: 120,
          width: 470,
          borderRadius: 72,
          background: C.navy,
          padding: 16,
          boxShadow: "0 60px 120px -40px rgba(14,18,34,0.6)",
          transform: `translateY(${(1 - phone) * 220}px)`,
          opacity: phone,
        }}
      >
        <div style={{ borderRadius: 58, background: C.paper, padding: "64px 28px 34px", fontFamily: BODY, color: C.navy }}>
          <div style={{ fontSize: 20, color: C.muted }}>Good morning</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 30, letterSpacing: "-0.03em" }}>Bukka Corner</div>
          <div style={{ marginTop: 18, borderRadius: 30, background: C.navy, color: C.card, padding: 26 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, opacity: 0.75 }}>
              <span>Wallet balance</span>
              <span>● Agent working</span>
            </div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 56, letterSpacing: "-0.04em", marginTop: 6 }}>{money(5992.66 - spent)}</div>
          </div>
          <div style={{ marginTop: 22, fontWeight: 700, fontSize: 22 }}>Paying today</div>
          {PEOPLE.map((p, i) => {
            const paid = frame >= paidAt(i);
            const flash = interpolate(frame, [paidAt(i), paidAt(i) + 20], [0.16, 0], clamp);
            return (
              <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 10px", borderRadius: 20, background: `rgba(18,161,80,${paid ? flash : 0})` }}>
                <Face src={p.photo} size={52} focus={p.focus} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 22 }}>{p.name}</div>
                  <div style={{ fontSize: 17, color: C.muted }}>
                    {p.role} · {p.netName}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, fontSize: 22 }}>{money(p.amount)}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: paid ? C.ok : C.blue }}>{paid ? "Paid" : "Paying…"}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Received cards */}
      {PEOPLE.map((p, i) => {
        const k = interpolate(frame, [paidAt(i) + 4, paidAt(i) + 22], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });
        const bob = Math.sin((frame - paidAt(i)) / 18) * 6;
        return (
          <div key={p.name} style={{ position: "absolute", ...spots[i], width: 330, opacity: k, transform: `translateY(${(1 - k) * 30 + bob}px) scale(${0.9 + k * 0.1})` }}>
            <Card style={{ padding: 22, borderRadius: 26 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <Face src={p.photo} size={56} focus={p.focus} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 22 }}>{p.name}</div>
                  <div style={{ fontSize: 17, color: C.muted }}>{p.role}</div>
                </div>
              </div>
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, fontFamily: DISPLAY, fontWeight: 800, fontSize: 30 }}>
                <Check size={26} /> +{money(p.amount)}
                <span style={{ fontFamily: BODY, fontWeight: 500, fontSize: 17, color: C.muted }}>received</span>
              </div>
              <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 8, background: C.paper, borderRadius: 999, padding: "6px 12px", fontSize: 16, fontWeight: 700 }}>
                <NetLogo id={p.net} size={18} /> {p.token} on {p.netName}
              </div>
            </Card>
          </div>
        );
      })}
    </Fill>
  );
}

/* 5. Any network, full pay ---------------------------------------------------- */
const NETS = ["near", "base", "solana", "tron", "ethereum", "arbitrum", "polygon", "bnb", "optimism", "avalanche", "sui"];

function Networks() {
  const frame = useCurrentFrame();
  const fee = useEnter(120);
  return (
    <Fill color={C.navy}>
      <div style={{ position: "absolute", left: 160, top: 150, right: 160 }}>
        <Eyebrow delay={4} color={C.accent}>
          Any network, full pay
        </Eyebrow>
        <div style={{ height: 20 }} />
        <Words text="Paid on the network they already use." size={88} color={C.card} delay={10} stagger={3} />
      </div>
      <div style={{ position: "absolute", left: 160, right: 160, top: 540, display: "flex", gap: 34, flexWrap: "wrap" }}>
        {NETS.map((n, i) => {
          const k = interpolate(frame, [40 + i * 5, 58 + i * 5], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
          return (
            <div key={n} style={{ width: 128, height: 128, borderRadius: 30, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "grid", placeItems: "center", transform: `scale(${k})`, opacity: k }}>
              <NetLogo id={n} size={72} />
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 160, top: 790, fontFamily: BODY, fontSize: 40, color: "rgba(255,255,255,0.78)", opacity: fee, transform: `translateY(${(1 - fee) * 16}px)` }}>
        USDC or USDT, through NEAR Intents. <span style={{ color: C.card, fontWeight: 700 }}>You cover the network fee. They get every cent.</span>
      </div>
    </Fill>
  );
}

/* 6. Every invoice checked ----------------------------------------------------- */
const CHECKS = [
  { q: "Paid already?", a: "No", ok: true },
  { q: "Same bank details as before?", a: "Yes", ok: true },
  { q: "Prices as you agreed?", a: "Yes", ok: true },
  { q: "Really your supplier?", a: "Look-alike: “Ek0”, not “Eko”", ok: false },
];

function Invoices() {
  const frame = useCurrentFrame();
  const doc = useEnter(8, 18);
  const scan = interpolate(frame, [30, 120], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const blocked = interpolate(frame, [190, 200], [2, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const blockedOp = interpolate(frame, [190, 196], [0, 1], clamp);
  const priv = useEnter(215);
  return (
    <Fill color={C.paper}>
      <div style={{ position: "absolute", left: 160, top: 120 }}>
        <Eyebrow delay={4}>Every invoice checked</Eyebrow>
        <div style={{ height: 18 }} />
        <Words text="Fakes never get paid." size={92} delay={10} />
      </div>
      {/* The invoice */}
      <div style={{ position: "absolute", left: 160, top: 360, width: 620, transform: `translateY(${(1 - doc) * 80}px) rotate(-2deg)`, opacity: doc }}>
        <Card style={{ padding: 44, position: "relative", overflow: "hidden" }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 40 }}>Ek0 Fresh Foods</div>
          <div style={{ fontSize: 22, color: C.muted, marginTop: 4 }}>Invoice #EFF-7781 · due today</div>
          {[
            ["Tomatoes (crate) × 6", "$108.00"],
            ["Fresh pepper (bag) × 4", "$100.00"],
            ["Onions (bag) × 3", "$77.00"],
          ].map(([a, b]) => (
            <div key={a} style={{ display: "flex", justifyContent: "space-between", fontSize: 24, marginTop: 22, paddingBottom: 14, borderBottom: `1px solid ${C.line}` }}>
              <span>{a}</span>
              <span>{b}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30, fontWeight: 800, marginTop: 22 }}>
            <span>Total</span>
            <span>$285.00</span>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: `${scan * 100}%`, height: 6, background: C.blue, boxShadow: `0 0 30px 10px rgba(48,71,224,0.35)`, opacity: scan > 0 && scan < 1 ? 1 : 0 }} />
        </Card>
        <div
          style={{
            position: "absolute",
            right: -40,
            top: 150,
            opacity: blockedOp,
            transform: `scale(${blocked}) rotate(-10deg)`,
            border: `6px solid ${C.refuse}`,
            color: C.refuse,
            background: "rgba(254,228,226,0.95)",
            borderRadius: 20,
            padding: "14px 26px",
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontSize: 48,
            textTransform: "uppercase",
          }}
        >
          Blocked · not paid
        </div>
      </div>
      {/* The checks */}
      <div style={{ position: "absolute", left: 960, top: 380, width: 800, display: "flex", flexDirection: "column", gap: 22 }}>
        {CHECKS.map((c, i) => {
          const at = 70 + i * 28;
          const k = interpolate(frame, [at, at + 14], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
          return (
            <div key={c.q} style={{ opacity: k, transform: `translateX(${(1 - k) * 40}px)` }}>
              <Card style={{ padding: 26, display: "flex", alignItems: "center", gap: 20, borderColor: c.ok ? C.line : C.refuse, background: c.ok ? C.card : C.refuseSoft }}>
                {c.ok ? <Check size={42} /> : <Shield size={42} />}
                <div>
                  <div style={{ fontSize: 30, fontWeight: 700 }}>{c.q}</div>
                  <div style={{ fontSize: 24, color: c.ok ? C.muted : C.refuse, fontWeight: c.ok ? 500 : 700 }}>{c.a}</div>
                </div>
              </Card>
            </div>
          );
        })}
        <div style={{ marginTop: 10, fontSize: 28, color: C.muted, fontFamily: BODY, opacity: priv }}>Read privately by NEAR AI, inside a sealed computer you can verify.</div>
      </div>
    </Fill>
  );
}

/* 7. Talk to it ---------------------------------------------------------------- */
function TalkToIt() {
  const frame = useCurrentFrame();
  const ask = "Pay Bisi a $20 bonus for covering Sunday";
  const typed = ask.slice(0, Math.max(0, Math.floor((frame - 30) / 1.6)));
  const card = useEnter(110, 16);
  const press = interpolate(frame, [150, 156, 162], [1, 0.92, 1], clamp);
  const sent = useEnter(170, 16);
  return (
    <Fill color={C.navy}>
      <div style={{ position: "absolute", left: 160, top: 300, width: 640 }}>
        <Eyebrow delay={4} color={C.accent}>
          Talk to it
        </Eyebrow>
        <div style={{ height: 20 }} />
        <Words text="Like a manager. Nothing moves until you say yes." size={80} color={C.card} delay={10} stagger={3} highlight={["yes."]} highlightColor={C.accent} />
      </div>
      <div style={{ position: "absolute", left: 980, top: 170, width: 780, display: "flex", flexDirection: "column", gap: 26, fontFamily: BODY }}>
        <div style={{ alignSelf: "flex-end", maxWidth: 640, background: C.blue, color: C.card, fontSize: 34, padding: "22px 30px", borderRadius: "34px 34px 10px 34px", minHeight: 82 }}>
          {typed}
          <span style={{ opacity: frame % 30 < 15 && typed.length < ask.length ? 1 : 0 }}>|</span>
        </div>
        <div style={{ opacity: card, transform: `translateY(${(1 - card) * 30}px)` }}>
          <Card style={{ borderRadius: "34px 34px 34px 10px", padding: 34, width: 640 }}>
            <div style={{ fontSize: 24, color: C.muted }}>Your agent</div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 40, marginTop: 6 }}>Pay Bisi Adeyemi $20.00</div>
            <div style={{ fontSize: 24, color: C.muted, marginTop: 6 }}>Bonus for covering Sunday · USDC on Base</div>
            <div style={{ marginTop: 22, display: "inline-block", background: C.blue, color: C.card, fontWeight: 700, fontSize: 28, padding: "14px 28px", borderRadius: 999, transform: `scale(${press})` }}>Yes, pay it</div>
          </Card>
        </div>
        <div style={{ opacity: sent, transform: `translateY(${(1 - sent) * 30}px)`, display: "flex", alignItems: "center", gap: 18, color: C.card, fontSize: 32, fontWeight: 600 }}>
          <Face src="photos/chef-abuja.jpg" size={66} focus="53% 14%" />
          <Check size={36} color={C.okBright} /> Bisi received $20.00
        </div>
      </div>
    </Fill>
  );
}

/* 8. Limits it can't break ------------------------------------------------------- */
function Limits() {
  const frame = useCurrentFrame();
  const bar = interpolate(frame, [40, 90], [0, 0.27], { ...clamp, easing: Easing.out(Easing.cubic) });
  const attempt = interpolate(frame, [120, 140], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const shake = frame > 150 && frame < 168 ? Math.sin(frame * 2.2) * 14 : 0;
  const refused = interpolate(frame, [150, 160], [0, 1], clamp);
  const foot = useEnter(190);
  return (
    <Fill color={C.paper}>
      <div style={{ position: "absolute", left: 160, top: 130 }}>
        <Eyebrow delay={4}>Limits it can&apos;t break</Eyebrow>
        <div style={{ height: 18 }} />
        <Words text="The AI pays. Your wallet sets the rules." size={84} delay={10} stagger={3} highlight={["wallet"]} />
      </div>
      <div style={{ position: "absolute", left: 160, top: 420, width: 760 }}>
        <Card style={{ padding: 40 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30, fontWeight: 700 }}>
            <span>Weekly limit</span>
            <span style={{ color: C.muted, fontWeight: 500 }}>$663 of $2,500</span>
          </div>
          <div style={{ marginTop: 18, height: 16, borderRadius: 99, background: "#eef0f4" }}>
            <div style={{ height: 16, width: `${bar * 100}%`, borderRadius: 99, background: C.blue }} />
          </div>
          {["Largest single payment · $900", "Only people you approved", "Emergency stop · one tap"].map((t, i) => {
            const k = useEnterInline(frame, 60 + i * 12);
            return (
              <div key={t} style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 14, fontSize: 28, opacity: k }}>
                <Check size={30} color={C.blue} /> {t}
              </div>
            );
          })}
        </Card>
      </div>
      <div style={{ position: "absolute", left: 1010, top: 450, width: 760, opacity: attempt, transform: `translateX(${(1 - attempt) * 120 + shake}px)` }}>
        <Card style={{ padding: 36, borderColor: refused > 0.5 ? C.refuse : C.line }}>
          <div style={{ fontSize: 24, color: C.muted }}>A request comes in</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 44, marginTop: 6 }}>Pay $5,000 to 0x9f3c…a1d2</div>
          <div style={{ fontSize: 24, color: C.muted, marginTop: 6 }}>Not on your list · above your limit</div>
          <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 14, color: C.refuse, fontWeight: 800, fontSize: 34, opacity: refused }}>
            <Shield size={40} /> Refused by your wallet
          </div>
        </Card>
      </div>
      <div style={{ position: "absolute", left: 1010, top: 820, width: 760, fontSize: 30, color: C.muted, fontFamily: BODY, opacity: foot }}>
        Enforced by your agent&apos;s own account on <b style={{ color: C.navy }}>NEAR Intents</b>, not by the AI. Even a tricked AI can&apos;t go past it.
      </div>
    </Fill>
  );
}

function useEnterInline(frame: number, at: number) {
  return interpolate(frame, [at, at + 14], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
}

/* 9. Everything around it -------------------------------------------------------- */
const stroke = { fill: "none", stroke: "#fff", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const ICONS: Record<string, React.ReactNode> = {
  team: (
    <svg width="44" height="44" viewBox="0 0 24 24" {...stroke}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M15.8 14.2c2.2.2 3.9 1.8 4.4 4.3" />
    </svg>
  ),
  records: (
    <svg width="44" height="44" viewBox="0 0 24 24" {...stroke}>
      <path d="M6 3h9l3 3v15H6z" />
      <path d="M9 10h6M9 14h6M9 18h4" />
    </svg>
  ),
  back: (
    <svg width="44" height="44" viewBox="0 0 24 24" {...stroke}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </svg>
  ),
  fix: (
    <svg width="44" height="44" viewBox="0 0 24 24" {...stroke}>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 4v5h-5" />
    </svg>
  ),
};
const TILES = [
  { t: "Your whole team in minutes", s: "Upload a spreadsheet or share one link in your staff chat.", icon: "team" },
  { t: "Records your accountant wants", s: "Every payment with proof. One-tap CSV.", icon: "records" },
  { t: "Your money, back any time", s: "Move it to your own wallet whenever you like.", icon: "back" },
  { t: "Fixes problems itself", s: "Low balance? It waits, then pays when you top up.", icon: "fix" },
];

function Everything() {
  const frame = useCurrentFrame();
  return (
    <Fill color={C.navy}>
      <div style={{ position: "absolute", left: 160, top: 140 }}>
        <Eyebrow delay={4} color={C.accent}>
          And everything around it
        </Eyebrow>
        <div style={{ height: 18 }} />
        <Words text="A payroll team of one, that never sleeps." size={84} color={C.card} delay={10} stagger={3} />
      </div>
      <div style={{ position: "absolute", left: 160, right: 160, top: 470, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30 }}>
        {TILES.map((x, i) => {
          const k = useEnterInline(frame, 50 + i * 14);
          return (
            <div key={x.t} style={{ opacity: k, transform: `translateY(${(1 - k) * 40}px)` }}>
              <div style={{ borderRadius: 30, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", padding: 36, display: "flex", gap: 26, alignItems: "center", fontFamily: BODY }}>
                <div style={{ width: 84, height: 84, borderRadius: 24, background: C.blue, color: C.card, display: "grid", placeItems: "center", flexShrink: 0 }}>{ICONS[x.icon]}</div>
                <div>
                  <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 36, color: C.card, letterSpacing: "-0.02em" }}>{x.t}</div>
                  <div style={{ fontSize: 26, color: "rgba(255,255,255,0.7)", marginTop: 6 }}>{x.s}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Fill>
  );
}

/* 10. End card ---------------------------------------------------------------------- */
function EndCard() {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [6, 50], [0, 1], clamp);
  const word = useEnter(36);
  const line = useEnter(62);
  const url = useEnter(92);
  const faces = PEOPLE.map((x) => x);
  return (
    <Fill color={C.blue}>
      <Center>
        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <Mark size={180} progress={p} reversed />
          <div style={{ opacity: word, transform: `translateX(${(1 - word) * -30}px)` }}>
            <Wordmark size={150} color={C.card} />
          </div>
        </div>
        <div style={{ marginTop: 46, fontFamily: DISPLAY, fontWeight: 800, fontSize: 76, color: C.card, letterSpacing: "-0.04em", textAlign: "center", opacity: line, transform: `translateY(${(1 - line) * 20}px)` }}>
          Pay everyone. Never the wrong person.
        </div>
        <div style={{ marginTop: 50, display: "flex", alignItems: "center", gap: 26, opacity: url, transform: `translateY(${(1 - url) * 20}px)` }}>
          <div style={{ display: "flex" }}>
            {faces.map((f, i) => (
              <div key={f.name} style={{ marginLeft: i ? -18 : 0, border: `4px solid ${C.blue}`, borderRadius: "50%" }}>
                <Face src={f.photo} size={72} focus={f.focus} />
              </div>
            ))}
          </div>
          <div style={{ background: C.card, color: C.blue, fontFamily: DISPLAY, fontWeight: 800, fontSize: 44, padding: "16px 40px", borderRadius: 999 }}>bursr.xyz</div>
        </div>
        <div style={{ marginTop: 40, fontFamily: BODY, fontSize: 28, color: C.lilac, opacity: url }}>Built on NEAR · NEAR Intents · NEAR AI</div>
      </Center>
    </Fill>
  );
}
