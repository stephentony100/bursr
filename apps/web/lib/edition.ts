// Which edition this build is, safe for the browser and the server: the Stellar
// edition when BURSR_CHAIN=stellar (next.config passes it to the browser).
export const STELLAR_EDITION = process.env.NEXT_PUBLIC_BURSR_CHAIN === "stellar";
