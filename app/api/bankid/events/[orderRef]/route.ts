export const runtime = "nodejs";

import { NextRequest } from "next/server";

// Global type declaration for storing SSE connections
declare global {
  var clients: Record<string, Array<{ write: (msg: unknown) => void }>>;
}

export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ orderRef: string }> }
) => {
  const { orderRef } = await params;

  const stream = new ReadableStream({
    start(controller) {

      const encoder = new TextEncoder();

      function send(data: unknown) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      }

      // Store connection
      global.clients ||= {};
      global.clients[orderRef] ||= [];
      global.clients[orderRef].push({
        write: (msg: unknown) => send(msg)
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache"
    }
  });
}