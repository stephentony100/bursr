# Submission drafts (for the owner to review; nothing here is sent or posted by an agent)

Deadline: **14 Nov 2026, 23:59 UTC** (00:59 on 15 Nov in Lagos). One submission, no edits after sending.

## 1. Demo video (under 2 minutes)

Record in practice mode from a fresh `npm run demo` (it shows "Demo · practice money"), plus the live mainnet links at the end. Screen at 1440×900, browser zoom 100%. Lead with the problem; show one full moment; say plainly what NEAR does.

| Time | Screen | Say (or caption) |
| --- | --- | --- |
| 0:00–0:10 | Home page hero: the phone running payday, the look-alike blocked | "Paying staff and suppliers is where small businesses lose money: fake invoices, changed bank details, the same bill twice. Bursr is an AI payroll agent that pays everyone, and never the wrong person." |
| 0:10–0:25 | **Get started** → Home: balance card, Recent payments filling in by themselves | "On payday the agent pays everyone on its own, in digital dollars, on the network each person uses: Base, Solana, Tron, NEAR." |
| 0:25–0:45 | **Invoices**: Ek0 Fresh Foods blocked, changed bank details blocked, duplicate and overpriced held | "Every invoice is read by NEAR AI in a sealed computer and checked. A look-alike supplier, new bank details, a double bill, a price above what you agreed: none of them get paid." |
| 0:45–0:55 | **Check the proof** → "Proof checked" | "And you don't have to trust us: Bursr checks the hardware's signed proof live." |
| 0:55–1:15 | **Payments** → **Try to sneak a big payment past your limits** → "Blocked by your spending rules" | "The AI never holds the keys. Your limits live in the agent's own account on NEAR Intents. Even a tricked AI can't send more than you allow, or to anyone you didn't approve." |
| 1:15–1:30 | **Agent** chat: "Pay Bisi a $20 bonus for Sunday" → card → **Yes, pay it** (needs a NEAR AI key), or **Run payday now** | "Talk to it like a manager. Nothing moves until you confirm." |
| 1:30–1:45 | **People** → Add people tabs (spreadsheet, group link) and **Wallet** → Move money back | "Add your whole team from a spreadsheet or one link in your staff chat, and take your money back any time." |
| 1:45–1:58 | README "Live run": the Base and Sui transactions | "It already runs on NEAR mainnet: real payments, real limits, refused exactly when they should be. Bursr: built at NEAR HACKATHON." |

## 2. X post (owner posts; must say it was built at NEAR HACKATHON and attach the video)

> Small businesses lose real money paying the wrong person: look-alike suppliers, "our bank details changed", the same bill twice.
>
> I built Bursr at #NEARHackathon: an AI payroll agent that pays your staff and suppliers in USDC/USDT on any network, checks every invoice first, and can't break your limits, because they're enforced by its NEAR Intents account, not the AI.
>
> Live on NEAR mainnet. Code: https://github.com/stephentony100/bursr
>
> @NEARProtocol

(Under 280 characters per post if split: post 1 = first paragraph + video; post 2 = the rest.)

## 3. Submission payload (POST https://nearhackathon.com/api/applications, or the form at https://nearhackathon.com/#apply)

Fields per HACKATHON.md. Do not add any other field (`website` is a spam trap). Values in `<…>` need the owner.

```json
{
  "requestId": "<new UUID, generated once and reused on retries>",
  "projectName": "Bursr",
  "leadName": "<your full name>",
  "email": "<the email to contact you on>",
  "size": "1",
  "tracks": ["business", "realworld", "privacy", "security", "agents"],
  "nearAddress": "stephentony.near",
  "projectUrl": "https://github.com/stephentony100/bursr",
  "demoUrl": "<link to your X post>",
  "idea": "Bursr is an AI payroll agent for small businesses. It reads supplier invoices (NEAR AI Cloud, inside a TEE whose proof the app verifies), checks them for look-alike suppliers, changed bank details, duplicates and overpricing, and pays staff and suppliers on schedule in USDC or USDT on the network each person uses, through NEAR Intents (1Click quotes, Agent API swaps and withdrawals). The AI never holds a full-access key: the weekly limit, per-payment cap, approved-payee list and emergency stop live in the agent account's signed policy, so the account itself refuses anything outside them. The business pays the network fee so people receive their full pay; Bursr earns 0.5% per payment run. Proven on NEAR mainnet with real cross-chain payments to Base and Sui and live refusals.",
  "consent": true
}
```

Notes:
- `tracks`: business (Autonomous Business), realworld (Real-World Money), privacy (Privacy & Private AI), security (AI Security & Defense); `agents` added as a suggestion because Bursr is an autonomous agent. Remove it if you prefer the original four.
- `consent: true` only after you have read and agreed to the contact notice on the form.
- `idea` is 1,000-odd characters (limit 2,000).
