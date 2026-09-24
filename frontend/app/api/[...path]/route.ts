import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function proxyRequest(request: NextRequest, { params }: { params: { path: string[] } }) {
  const backendBase = process.env.BACKEND_URL || "http://127.0.0.1:8000";
  const path = (params.path || []).join("/");
  const targetUrl = `${backendBase}/api/${path}${request.nextUrl.search}`;

  const headers = new Headers(request.headers);
  headers.delete("host");

  const method = request.method;
  const body =
    method !== "GET" && method !== "HEAD" ? await request.arrayBuffer() : undefined;

  try {
    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
      cache: "no-store",
    });

    const respHeaders = new Headers(response.headers);
    respHeaders.delete("content-encoding");

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: respHeaders,
    });
  } catch (error: any) {
    console.error(`[API Proxy Error] Failed to fetch ${targetUrl}:`, error);
    return NextResponse.json(
      { error: "Backend service unreachable", details: error.message, targetUrl },
      { status: 502 }
    );
  }
}

export {
  proxyRequest as GET,
  proxyRequest as POST,
  proxyRequest as PUT,
  proxyRequest as PATCH,
  proxyRequest as DELETE,
  proxyRequest as OPTIONS,
};
