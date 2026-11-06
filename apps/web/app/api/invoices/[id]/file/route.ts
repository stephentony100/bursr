import { db } from "@/lib/db";
import { getOwner } from "@/lib/session";

// The original invoice file, for the owner to look at next to Bursar's reading.
export async function GET(_req: Request, ctx: RouteContext<"/api/invoices/[id]/file">) {
  if (!(await getOwner())) return new Response("Sign in first.", { status: 401 });
  const { id } = await ctx.params;
  const row = await db().invoice.findUnique({ where: { id }, select: { file: true, mediaType: true } });
  if (!row) return new Response("Not found", { status: 404 });
  const type = /^(image\/(png|jpeg|webp)|text\/plain)$/.test(row.mediaType) ? row.mediaType : "application/octet-stream";
  return new Response(Buffer.from(row.file), {
    headers: { "Content-Type": type, "Content-Security-Policy": "default-src 'none'", "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=3600" },
  });
}
