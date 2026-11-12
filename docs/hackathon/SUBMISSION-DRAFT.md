# Submission drafts (for the owner to review; nothing here is sent or posted by an agent)

Deadline: **14 Nov 2026, 23:59 UTC** (00:59 on 15 Nov in Lagos). One submission, no edits after sending.

## 1. Demo video (under 2 minutes, recorded on https://bursr.xyz with real money)

Before recording: a fresh business on bursr.xyz (signed in with your NEAR wallet), limits small (e.g. $20 a week, $10 a payment), 1–2 USDC added, and one person whose wallet you control (another of your addresses, e.g. USDC on Base). Screen at 1440×900, zoom 100%. Lead with the problem, show one complete moment, say plainly what NEAR does.

| Time | Screen | Say (or caption) |
| --- | --- | --- |
| 0:00–0:10 | bursr.xyz home: the phone running payday, the look-alike blocked | "Paying staff and suppliers is where small businesses lose money: fake invoices, changed bank details, the same bill twice. Bursr is an AI payroll agent that pays everyone, and never the wrong person." |
| 0:10–0:25 | **Get started** → **Connect my wallet** → setup: your business, **Your limits** | "You sign in with your own NEAR wallet and set your limits once. They're signed into the agent's own account on NEAR Intents, so the AI can't change them." |
| 0:25–0:40 | **Who you pay** → invite link → the person's page (another browser) → **Approve** → **Confirm with my wallet** | "Your staff fill in how they want to be paid, on any network. Only your wallet can add them." |
| 0:40–0:55 | **Wallet** → add money (one tap from your NEAR wallet) | "Top up with USDC. The agent pays from its own wallet, never from yours." |
| 0:55–1:15 | Home → **Ask agent**: "Pay Kemi $0.50 for Saturday" → **Yes, pay it** → feed: started, exchanging, sending, received | "Talk to it like a manager. It pays across chains through NEAR Intents, and the business covers the network fee so they get every cent." |
| 1:15–1:30 | Block explorer: the payment arriving in the other wallet | "Real money, on mainnet, in seconds." |
| 1:30–1:45 | **Invoices** → paste an invoice from a look-alike name → **Blocked: don't pay** | "Every invoice is read by NEAR AI in a sealed computer and checked: look-alikes, changed bank details, duplicates, overcharges." |
| 1:45–1:58 | **Payments** → **Try to sneak a big payment past your limits** → refused | "Even a tricked AI can't send more than you allow. Bursr: built at NEAR HACKATHON. Try it at bursr.xyz." |

## 2. X post (owner posts; must say it was built at NEAR HACKATHON and attach the video)

> Small businesses lose real money paying the wrong person: look-alike suppliers, "our bank details changed", the same bill twice.
>
> I built Bursr at #NEARHackathon: an AI payroll agent that pays your staff and suppliers in USDC/USDT on any network, checks every invoice first, and can't break your limits, because they're enforced by its NEAR Intents account, not the AI.
>
> Live on NEAR mainnet: https://bursr.xyz
> Code: https://github.com/stephentony100/bursr
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
  "idea": "Bursr is an AI payroll agent for small businesses. It reads supplier invoices (NEAR AI Cloud, inside a TEE whose proof the app verifies), checks them for look-alike suppliers, changed bank details, duplicates and overpricing, and pays staff and suppliers on schedule in USDC or USDT on the network each person uses, through NEAR Intents (1Click quotes, Agent API swaps and withdrawals). The AI never holds a full-access key: the weekly limit, per-payment cap, approved-payee list and emergency stop live in the agent account's signed policy, so the account itself refuses anything outside them. The business pays the network fee so people receive their full pay; Bursr earns 0.5% per payment run. Live at https://bursr.xyz, proven on NEAR mainnet with real cross-chain payments to Base and Sui and live refusals.",
  "consent": true
}
```

Notes:
- `tracks`: business (Autonomous Business), realworld (Real-World Money), privacy (Privacy & Private AI), security (AI Security & Defense); `agents` added as a suggestion because Bursr is an autonomous agent. Remove it if you prefer the original four.
- `consent: true` only after you have read and agreed to the contact notice on the form.
- `idea` is 1,000-odd characters (limit 2,000).
