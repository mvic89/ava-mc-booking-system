import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, statSync } from 'fs';
import { join } from 'path';

const ALLOWED: Record<string, string> = {
  'bike.mp4': 'video/mp4',
  'bikemenow.mp4': 'video/mp4',
  'movie.mp4': 'video/mp4',
  'bike.mp3': 'audio/mpeg',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  const contentType = ALLOWED[file];
  if (!contentType) return new NextResponse('Not found', { status: 404 });

  const filePath = join(process.cwd(), 'public', file);

  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(filePath);
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }

  const fileSize = stat.size;
  const rangeHeader = request.headers.get('range');

  const start = rangeHeader ? parseInt(rangeHeader.replace(/bytes=/, '').split('-')[0], 10) : 0;
  const end = rangeHeader
    ? (parseInt(rangeHeader.replace(/bytes=/, '').split('-')[1], 10) || fileSize - 1)
    : fileSize - 1;
  const chunkSize = end - start + 1;

  const nodeStream = createReadStream(filePath, { start, end });

  const readable = new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk: Buffer | string) => {
        try {
          controller.enqueue(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        } catch {
          nodeStream.destroy();
        }
      });
      nodeStream.on('end', () => {
        try { controller.close(); } catch { /* already closed */ }
      });
      nodeStream.on('error', (err) => {
        try { controller.error(err); } catch { /* already closed */ }
      });
    },
    cancel() {
      nodeStream.destroy();
    },
  });

  return new NextResponse(readable, {
    status: rangeHeader ? 206 : 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(chunkSize),
      'Accept-Ranges': 'bytes',
      ...(rangeHeader ? { 'Content-Range': `bytes ${start}-${end}/${fileSize}` } : {}),
    },
  });
}
