import { handleApi } from "@/server/api/handler";

// Galla REST API v1 — see docs/API.md, or GET /api/v1 for the live route list.
type Ctx = { params: Promise<{ path?: string[] }> };
const handler = async (req: Request, { params }: Ctx) => handleApi(req, (await params).path);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const dynamic = "force-dynamic";
