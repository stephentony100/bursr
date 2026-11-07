import { pass, type Check } from "./types";

/**
 * The Reader (AI) quotes any pressure or threat wording ("pay today or your
 * account will be closed"). That is only a flag for the owner: an AI opinion
 * never blocks a payment on its own.
 */
export const urgency: Check = (invoice) => {
  const note = invoice.extracted.urgencyNote?.trim();
  if (!note) return pass("urgency");
  return { check: "urgency", status: "flag", reason: `Warning sign: this invoice pushes you to pay fast ("${note}"). Scammers often rush people, so take your time.` };
};
