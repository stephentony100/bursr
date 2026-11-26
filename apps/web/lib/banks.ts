// Nigerian banks and their codes, from Linq's docs ("Common banks"). Safe for
// the browser. `000` is the practice bank (no real money).

export const NIGERIAN_BANKS: { code: string; name: string }[] = [
  { code: "044", name: "Access Bank" },
  { code: "058", name: "GTBank" },
  { code: "011", name: "First Bank" },
  { code: "057", name: "Zenith Bank" },
  { code: "033", name: "UBA" },
  { code: "090267", name: "Kuda Microfinance Bank" },
  { code: "100004", name: "OPay" },
  { code: "100033", name: "PalmPay" },
  { code: "090405", name: "Moniepoint MFB" },
  { code: "035", name: "Wema Bank" },
  { code: "232", name: "Sterling Bank" },
  { code: "070", name: "Fidelity Bank" },
  { code: "214", name: "FCMB" },
  { code: "039", name: "Stanbic IBTC" },
  { code: "076", name: "Polaris Bank" },
];

export const PRACTICE_BANK = { code: "000", name: "Practice Bank" };
