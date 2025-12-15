import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Add CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle OPTIONS request for CORS preflight
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200, headers });
  }

  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    
    if (!backendUrl) {
      console.error('NEXT_PUBLIC_BACKEND_URL is not set');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Backend URL not configured. Please set NEXT_PUBLIC_BACKEND_URL environment variable.' 
        },
        { status: 500, headers }
      );
    }

    const body = await request.json();

    console.log(`Proxying request to: ${backendUrl}/api/instagram/cookie/connect`);

    const response = await fetch(`${backendUrl}/api/instagram/cookie/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return NextResponse.json(data, { 
      status: response.status,
      headers 
    });
  } catch (error: any) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to connect to backend',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500, headers }
    );
  }
}

