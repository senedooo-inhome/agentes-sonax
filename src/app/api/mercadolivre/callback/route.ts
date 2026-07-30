import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      { error: "Código não recebido" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    code,
  });
}