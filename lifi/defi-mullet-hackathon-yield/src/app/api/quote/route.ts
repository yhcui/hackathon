import { NextRequest, NextResponse } from 'next/server';

const COMPOSER_API = 'https://li.quest';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const fromChain = searchParams.get('fromChain');
  const toChain = searchParams.get('toChain');
  const fromToken = searchParams.get('fromToken');
  const toToken = searchParams.get('toToken');
  const fromAddress = searchParams.get('fromAddress');
  const toAddress = searchParams.get('toAddress');
  const fromAmount = searchParams.get('fromAmount');

  if (
    !fromChain ||
    !toChain ||
    !fromToken ||
    !toToken ||
    !fromAddress ||
    !fromAmount
  ) {
    return NextResponse.json(
      { error: 'Missing required parameters' },
      { status: 400 }
    );
  }

  try {
    const params = new URLSearchParams({
      fromChain,
      toChain: toChain || fromChain,
      fromToken,
      toToken,
      fromAddress,
      toAddress: toAddress || fromAddress,
      fromAmount,
    });

    const url = `${COMPOSER_API}/v1/quote?${params.toString()}`;
    const res = await fetch(url);

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { error: 'Composer request failed', details: errorText },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching quote:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
