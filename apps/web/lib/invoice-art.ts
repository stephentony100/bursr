import type { SampleInvoice } from "./sample-invoices";

// Draws a sample invoice as SVG (rendered to PNG by scripts/make-sample-invoices.ts).
// Each supplier gets its own letterhead so the six images look like six papers.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const LETTERHEADS: Record<string, { color: string; address: string; phone: string }> = {
  "Mama Put Farms Ltd": { color: "#2f6b2f", address: "14 Oyingbo Market Road, Lagos", phone: "0803 555 0142" },
  "Ikeja Gas & Charcoal": { color: "#b3471d", address: "7 Obafemi Awolowo Way, Ikeja", phone: "0812 555 0199" },
  "Ek0 Fresh Foods": { color: "#1d4f91", address: "22 Marina Road, Lagos Island", phone: "0901 555 0777" },
  "Eko Fresh Foods": { color: "#1d4f91", address: "22 Marina Road, Lagos Island", phone: "0809 555 0310" },
};

function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if ((line + " " + word).trim().length > max) {
      out.push(line);
      line = word;
    } else line = (line + " " + word).trim();
  }
  if (line) out.push(line);
  return out;
}

export function invoiceSvg(s: SampleInvoice, billTo: string): string {
  const p = s.printed;
  const lh = LETTERHEADS[p.supplierName] ?? { color: "#333", address: "", phone: "" };
  const rows = p.lines
    .map((l, i) => {
      const y = 420 + i * 40;
      return `<text x="60" y="${y}">${esc(l.description)}</text><text x="440" y="${y}" text-anchor="end">${esc(l.quantity)}</text><text x="590" y="${y}" text-anchor="end">${esc(l.unitPrice)}</text><text x="740" y="${y}" text-anchor="end">${esc(l.lineTotal)}</text>`;
    })
    .join("");
  const endY = 420 + p.lines.length * 40;
  let y = endY + 110;
  const pay: string[] = [];
  if (s.notice) {
    const lines = wrap(s.notice, 62);
    pay.push(`<rect x="50" y="${y - 30}" width="700" height="${lines.length * 24 + 24}" fill="#fff3cd" stroke="#c99a06"/>`);
    lines.forEach((l, i) => pay.push(`<text x="64" y="${y + i * 24}" font-weight="bold" fill="#7a5a00">${esc(l)}</text>`));
    y += lines.length * 24 + 40;
  }
  if (p.payout?.address) {
    pay.push(`<text x="60" y="${y}" font-weight="bold">Payment: ${esc(p.payout.token ?? "")} on ${esc((p.payout.chain ?? "").toUpperCase())}</text>`);
    pay.push(`<text x="60" y="${y + 26}" font-family="Courier New, monospace" font-size="15">${esc(p.payout.address)}</text>`);
  }
  const stamp = s.stamp
    ? `<g transform="rotate(-14 560 210)"><rect x="440" y="170" width="250" height="70" fill="none" stroke="#c0392b" stroke-width="4" rx="8"/><text x="565" y="217" text-anchor="middle" font-size="30" font-weight="bold" fill="#c0392b">${esc(s.stamp)}</text></g>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
<rect width="800" height="1000" fill="#ffffff"/>
<rect width="800" height="14" fill="${lh.color}"/>
<g font-family="Arial, Helvetica, sans-serif" font-size="17" fill="#111">
<text x="60" y="90" font-size="32" font-weight="bold" fill="${lh.color}">${esc(p.supplierName)}</text>
<text x="60" y="120" font-size="15" fill="#555">${esc(lh.address)} · ${esc(lh.phone)}</text>
<text x="740" y="90" font-size="28" font-weight="bold" text-anchor="end">INVOICE</text>
<text x="740" y="120" text-anchor="end">No. ${esc(p.invoiceNumber)}</text>
<text x="60" y="200">Bill to: ${esc(billTo)}</text>
<text x="60" y="228">Invoice date: ${esc(p.invoiceDate ?? "")}</text>
<text x="60" y="256">Due date: ${esc(p.dueDate ?? "")}</text>
<text x="60" y="284">Currency: ${esc(p.currency)}</text>
${stamp}
<line x1="60" y1="360" x2="740" y2="360" stroke="#111" stroke-width="2"/>
<text x="60" y="388" font-weight="bold">Item</text><text x="440" y="388" font-weight="bold" text-anchor="end">Qty</text><text x="590" y="388" font-weight="bold" text-anchor="end">Unit price</text><text x="740" y="388" font-weight="bold" text-anchor="end">Amount</text>
<line x1="60" y1="398" x2="740" y2="398" stroke="#999"/>
${rows}
<line x1="60" y1="${endY - 10}" x2="740" y2="${endY - 10}" stroke="#111" stroke-width="2"/>
<text x="590" y="${endY + 30}" font-size="19" font-weight="bold" text-anchor="end">TOTAL</text>
<text x="740" y="${endY + 30}" font-size="19" font-weight="bold" text-anchor="end">${esc(p.total)}</text>
${pay.join("\n")}
<text x="60" y="960" font-size="13" fill="#888">Sample invoice for the Bursr demo. Fictional business; not a real bill.</text>
</g>
</svg>`;
}
