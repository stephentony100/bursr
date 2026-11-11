import type { Payee, PayoutToken } from "@/lib/domain";
import { formatUnits, USD_DECIMALS } from "@/lib/money";
import { chainName } from "@/lib/tokens";

const input = "mt-1 block w-full rounded-md border border-line bg-card px-3 py-2";

export function DetailFields({ payee }: { payee?: Payee }) {
  const prices = payee?.prices.map((p) => `${p.item} = ${formatUnits(BigInt(p.unitPriceUsd), USD_DECIMALS)}`).join("\n") ?? "";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-medium">
        Name
        <input name="name" defaultValue={payee?.name} required className={input} />
      </label>
      <label className="block text-sm font-medium">
        Type
        <select name="category" defaultValue={payee?.category ?? "supplier"} className={input}>
          <option value="supplier">Supplier</option>
          <option value="staff">Staff</option>
          <option value="software">Subscription or service</option>
        </select>
      </label>
      <label className="block text-sm font-medium sm:col-span-2">
        Prices you agreed <span className="font-normal text-muted">(optional, one per line, in dollars)</span>
        <textarea name="prices" defaultValue={prices} rows={3} placeholder="Tomatoes (crate) = 18.00" className={`${input} num`} />
        <span className="mt-1 block font-normal text-muted">If an invoice charges more than 5% above these, Bursar holds it for you to check.</span>
      </label>
      <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:max-w-xl sm:grid-cols-3">
        <label className="block text-sm font-medium">
          Regular pay, like wages <span className="font-normal text-muted">(optional)</span>
          <span className="mt-1 flex items-center rounded-md border border-line bg-card">
            <span className="pl-3 text-muted">$</span>
            <input
              name="recurringAmount"
              defaultValue={payee?.recurring ? formatUnits(BigInt(payee.recurring.amountUsd), USD_DECIMALS) : ""}
              inputMode="decimal"
              className="num w-full bg-transparent px-2 py-2 outline-none"
            />
          </span>
        </label>
        <label className="block text-sm font-medium">
          Every
          <select name="recurringEvery" defaultValue={payee?.recurring?.every ?? "week"} className={input}>
            <option value="week">Week (on payday)</option>
            <option value="two_weeks">2 weeks (every other payday)</option>
            <option value="month">Month</option>
          </select>
        </label>
        <p className="col-span-2 text-sm text-muted sm:col-span-3 sm:order-last">
          Leave it empty for suppliers you pay by invoice: Bursar then pays them only when they send one and it passes the checks.
        </p>
        <label className="col-span-2 block text-sm font-medium sm:col-span-1">
          If monthly, pay on
          <select name="recurringDay" defaultValue={payee?.recurring?.day ?? ""} className={input}>
            <option value="">The first payday</option>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                Day {d}
              </option>
            ))}
            <option value={0}>The last working day</option>
          </select>
        </label>
      </div>
    </div>
  );
}

export function PayoutFields({ tokens, payee }: { tokens: PayoutToken[]; payee?: Payee }) {
  return (
    <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
      <label className="block text-sm font-medium">
        How they want to be paid
        <select name="token" defaultValue={payee?.payout.token.assetId} required className={input}>
          {tokens.map((t) => (
            <option key={t.assetId} value={t.assetId}>
              {t.symbol} on {chainName(t.chain)}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium">
        Their wallet address
        <input name="address" defaultValue={payee?.payout.address} required spellCheck={false} className={`${input} num text-sm`} />
      </label>
      <label className="block text-sm font-medium sm:col-start-2">
        Memo <span className="font-normal text-muted">(leave empty unless they gave you one)</span>
        <input name="memo" defaultValue={payee?.payout.memo ?? ""} className={`${input} num text-sm`} />
      </label>
    </div>
  );
}
