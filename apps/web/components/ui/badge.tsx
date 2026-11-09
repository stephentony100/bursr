import { CheckCircle, PauseCircle, Prohibit } from "@phosphor-icons/react/dist/ssr";

export type Tone = "ready" | "hold" | "block" | "neutral";

const STYLE: Record<Tone, string> = {
  ready: "bg-ledger-soft text-ledger",
  hold: "bg-hold-soft text-hold",
  block: "bg-refuse-soft text-refuse",
  neutral: "bg-paper-2 text-muted",
};

const ICON = { ready: CheckCircle, hold: PauseCircle, block: Prohibit, neutral: null } as const;

/** A status pill. The icon and text carry the meaning; colour only reinforces it. */
export function Badge({ tone, children, className = "" }: { tone: Tone; children: React.ReactNode; className?: string }) {
  const Glyph = ICON[tone];
  return (
    <span className={`inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STYLE[tone]} ${className}`}>
      {Glyph && <Glyph size={13} weight="fill" aria-hidden />}
      {children}
    </span>
  );
}
