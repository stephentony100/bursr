import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-paper px-5">
      <div className="max-w-md rounded-xl border border-line bg-card p-8">
        <h1 className="display text-2xl">We can&apos;t find that page</h1>
        <p className="mt-2 text-muted">The link may be old or mistyped. If someone sent you an invite link, ask them for a new one.</p>
        <Link href="/" className="mt-6 inline-block rounded-lg bg-ledger px-4 py-2 text-sm font-semibold text-white hover:bg-indigo">
          Go to Bursr&apos;s home page
        </Link>
      </div>
    </div>
  );
}
