import { access, constants, mkdir } from "node:fs/promises";
import path from "node:path";
import { env } from "@/env";
import { connectDb } from "@/server/db";

export const dynamic = "force-dynamic";

/** Liveness + readiness for Railway/Docker health checks. Fails if MongoDB is down or not a replica set. */
export async function GET() {
  try {
    const db = (await connectDb()).connection.db!;
    const hello = await db.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== "isdbgrid") {
      return Response.json({ ok: false, error: "MongoDB must be a replica set (transactions). Use MongoDB Atlas or start mongod with --replSet." }, { status: 503 });
    }
    // Not a failure (the app still works), but shows at a glance if photos and bills cannot be saved.
    const dir = path.resolve(env.UPLOAD_DIR);
    const uploads = await mkdir(dir, { recursive: true }).then(() => access(dir, constants.W_OK)).then(() => "writable", () => "NOT WRITABLE");
    return Response.json({ ok: true, uploads });
  } catch {
    return Response.json({ ok: false, error: "Database unreachable" }, { status: 503 });
  }
}
