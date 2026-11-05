# NEAR HACKATHON — rules summary

Summarised from https://nearhackathon.com/HACKATHON.md on 3 Nov 2026. The live page wins if anything differs; re-read it before submitting.

- **Dates (UTC):** code window opened 19 Oct 2026 (announcement). Build 1–14 Nov; submissions close **14 Nov 23:59**. Judging 16–18 Nov; results by 18 Nov 23:59.
- **Prizes:** $250K in NEAR. Grand prize $55K; each of 13 tracks pays $10K / $3K / $2K. Single transfer within 30 days, no vesting.
- **Screening:** Claude Code and Codex screen every project first (reproducibility check, feature check, preliminary score). Humans decide; a low AI score alone cannot reject.
- **Existing products:** allowed, but only the NEAR integration built in the window is judged; disclose it and separate the diff (branch or tags `pre-hackathon` / `hackathon-submission`).
- **Libraries, templates, AI-generated code:** allowed; list them in the README.
- **Mandatory integrations:** none. Track hints are wishes.
- **Testnet:** testnet-only projects are eligible in every track. NEAR Intents has no testnet: use mainnet with tiny amounts and dry-run quotes.
- **1Click key:** optional; HACKATHON.md says a 0.2% fee applies without it, while the 1Click app-fees docs say 25 bps is added — check the current docs (see docs/NEAR-NOTES.md).
- **Demo:** public repo + reproducible README + X post with video. Screenshots alone are not enough if judges cannot open the demo. Keep any hosted demo up until at least 18 Nov (ideally 25 Nov).
- **License:** a LICENSE file is required (MIT is fine). Repo stays public through judging. Team keeps IP.
- **Multiple projects:** max 2 independent projects per person; each README names the other. One submission per project; each repo submitted once; max 2 submissions per email.
- **Never without the human's confirmation:** send the submission; post on X or elsewhere; make the repo public, push or force-push; sign transactions, spend tokens or deploy to mainnet; commit secrets.
- **Submission:** form at https://nearhackathon.com/#apply or `POST https://nearhackathon.com/api/applications` (fields and limits in HACKATHON.md; the `website` field is a spam trap — do not send it). Show the full payload to the human and wait for OK.
- **Demo post tips:** lead with the user problem; show one complete moment from user to result; skip long intros and architecture slides; explain NEAR's role concretely; end with a link and a question. Tag @NEARProtocol and #NEARHackathon.
