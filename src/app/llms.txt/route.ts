/**
 * LLMs.txt API Route
 * Serves llms.txt with proper headers for AI crawlers
 * 
 * This ensures AI models can discover and read the llms.txt file
 * with the correct content-type and caching headers.
 */

import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  try {
    // Read the llms.txt file from the public directory
    const filePath = join(process.cwd(), 'public', 'llms.txt');
    const content = await readFile(filePath, 'utf-8');

    // Return with proper headers for AI crawlers
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
        // CORS headers to allow AI crawlers
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        // Help AI crawlers discover this is an llms.txt file
        'X-Content-Type-Options': 'nosniff',
        // Link to robots.txt for discovery
        'Link': '</robots.txt>; rel="robots", </sitemap.xml>; rel="sitemap"',
      },
    });
  } catch (error) {
    console.error('Error serving llms.txt:', error);
    return new NextResponse('LLMs.txt file not found', { status: 404 });
  }
}

// Handle HEAD requests (used by crawlers to check if file exists)
export async function HEAD() {
  try {
    const filePath = join(process.cwd(), 'public', 'llms.txt');
    await readFile(filePath, 'utf-8');
    
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return new NextResponse(null, { status: 404 });
  }
}

// Handle OPTIONS requests (CORS preflight)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

