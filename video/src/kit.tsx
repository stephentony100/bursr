import React from "react";
import { Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BODY, C, DISPLAY } from "./theme";

// Shared pieces of the launch film: timing helpers, kinetic type, the logo
// draw-on (from the logo handoff's motion reference), cards and avatars.

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0→1 spring starting at `delay` frames. */
export function useEnter(delay = 0, damping = 200) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping } });
}

/** 1→0 near the end of a scene of `length` frames. */
export function useExit(length: number, over = 12) {
  const frame = useCurrentFrame();
  return interpolate(frame, [length - over, length], [1, 0], { ...clamp, easing: Easing.in(Easing.cubic) });
}

/** Words that rise into place one after another. */
export function Words({
  text,
  delay = 0,
  stagger = 4,
  size = 96,
  color = C.navy,
  weight = 800,
  highlight = [],
  highlightColor = C.blue,
  style,
}: {
  text: string;
  delay?: number;
  stagger?: number;
  size?: number;
  color?: string;
  weight?: number;
  highlight?: string[];
  highlightColor?: string;
  style?: React.CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  return (
    <div style={{ fontFamily: DISPLAY, fontWeight: weight, fontSize: size, letterSpacing: "-0.045em", lineHeight: 1.04, color, display: "flex", flexWrap: "wrap", gap: `0 ${size * 0.24}px`, ...style }}>
      {words.map((w, i) => {
        const k = spring({ frame: frame - delay - i * stagger, fps, config: { damping: 18, mass: 0.6 } });
        const clean = w.replace(/[.,!?]/g, "");
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingBottom: size * 0.08 }}>
            <span style={{ display: "inline-block", transform: `translateY(${(1 - k) * 110}%)`, color: highlight.includes(clean) ? highlightColor : undefined }}>{w}</span>
          </span>
        );
      })}
    </div>
  );
}

export function Eyebrow({ children, delay = 0, color = C.blue }: { children: React.ReactNode; delay?: number; color?: string }) {
  const k = useEnter(delay);
  return (
    <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 30, color, letterSpacing: "0.02em", opacity: k, transform: `translateY(${(1 - k) * 16}px)` }}>{children}</div>
  );
}

/** The Bursr mark drawing itself on: tile, then branches, then the payee dots. */
export function Mark({ size = 200, progress, reversed = false }: { size?: number; progress: number; reversed?: boolean }) {
  const seg = (a: number, b: number) => Math.min(1, Math.max(0, (progress - a) / (b - a)));
  const back = (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };
  const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const tile = reversed ? C.card : C.blue;
  const fan = reversed ? C.navy : C.card;
  const dots = reversed ? C.blue : C.navy;
  const t = back(seg(0, 0.3));
  const branch = (i: number) => inOut(seg(0.3 + i * 0.06, 0.7 + i * 0.06));
  const dot = (i: number) => (seg(0.6 + i * 0.1, 0.85 + i * 0.05) > 0 ? back(seg(0.6 + i * 0.1, 0.85 + i * 0.05)) : 0);
  const paths = ["M16 24C22 24 24 15 30 15", "M16 24L31 24", "M16 24C22 24 24 33 30 33"];
  const payees = [
    [33.5, 15],
    [34.5, 24],
    [33.5, 33],
  ];
  return (
    <svg width={size} height={size} viewBox="3 3 42 42">
      <rect x="3" y="3" width="42" height="42" rx="12" fill={tile} transform={`translate(24 24) scale(${t}) translate(-24 -24)`} />
      {paths.map((d, i) => (
        <path key={d} d={d} fill="none" stroke={fan} strokeWidth="3.2" strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - branch(i)} />
      ))}
      <circle cx="15" cy="24" r={5 * back(seg(0.2, 0.4))} fill={fan} />
      {payees.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={3.6 * dot(i)} fill={dots} />
      ))}
    </svg>
  );
}

export function Wordmark({ size = 120, color = C.navy }: { size?: number; color?: string }) {
  return <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: size, letterSpacing: "-0.045em", lineHeight: 1, color }}>Bursr</span>;
}

export function Face({ src, size = 64, focus = "50% 30%" }: { src: string; size?: number; focus?: string }) {
  return <Img src={staticFile(src)} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", objectPosition: focus, flexShrink: 0 }} />;
}

export function NetLogo({ id, size = 28 }: { id: string; size?: number }) {
  return <Img src={staticFile(`networks/${id}.svg`)} style={{ width: size, height: size, flexShrink: 0 }} />;
}

export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.card, borderRadius: 28, border: `1px solid ${C.line}`, boxShadow: "0 30px 60px -30px rgba(14,18,34,0.35)", padding: 28, fontFamily: BODY, color: C.navy, ...style }}>
      {children}
    </div>
  );
}

export function Check({ size = 28, color = C.ok }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="11" fill={color} />
      <path d="m7 12.5 3.2 3.2L17 9" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Shield({ size = 28, color = C.refuse }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z" fill={color} />
      <path d="M12 7v6M12 16.5v.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** A full-frame background. */
export function Fill({ color, children, style }: { color: string; children?: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ position: "absolute", inset: 0, background: color, overflow: "hidden", ...style }}>{children}</div>;
}
