import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, statSync } from 'fs';
import { join } from 'path';
import { Readable } from 'stream';

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

  if (rangeHeader) {
    const [startStr, endStr] = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const stream = createReadStream(filePath, { start, end });
    const readable = Readable.toWeb(stream) as ReadableStream;

    return new NextResponse(readable, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
        'Content-Type': contentType,
      },
    });
  }

  const stream = createReadStream(filePath);
  const readable = Readable.toWeb(stream) as ReadableStream;

  return new NextResponse(readable, {
    status: 200,
    headers: {
      'Content-Length': String(fileSize),
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    },
  });
}
