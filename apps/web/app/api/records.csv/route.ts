import { getOwner, appDb } from "@/lib/session";
import { statementCsv, statementLines } from "@/lib/statement";

export async function GET() {
  if (!(await getOwner())) return new Response("Sign in first.", { status: 401 });
  const csv = statementCsv(await statementLines((await appDb())));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bursar-statement-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
