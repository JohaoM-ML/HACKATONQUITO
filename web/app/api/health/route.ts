import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: "zanku",
    supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
}
