import { NextRequest, NextResponse } from 'next/server';

const EARN_API = 'https://earn.li.fi';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const chainId = searchParams.get('chainId');

  try {
    // Build query params
    const params = new URLSearchParams();
    if (chainId) params.set('chainId', chainId);

    const url = `${EARN_API}/v1/earn/vaults?${params.toString()}`;
    const res = await fetch(url, {
      next: { revalidate: 60 }, // Cache for 60 seconds
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch vaults' },
        { status: res.status }
      );
    }

    const data = await res.json();

    // Filter and sort vaults: only transactional ones, sorted by APY
    const vaults = (data.data || [])
      .filter((v: any) => v.isTransactional === true)
      .map((v: any) => ({
        address: v.address,
        network: v.network,
        chainId: v.chainId,
        slug: v.slug,
        name: v.name,
        protocol: v.protocol,
        underlyingTokens: v.underlyingTokens,
        tags: v.tags,
        analytics: {
          apy: {
            base: v.analytics?.apy?.base ?? 0,
            reward: v.analytics?.apy?.reward ?? 0,
            total: v.analytics?.apy?.total ?? 0,
          },
          apy1d: v.analytics?.apy1d ?? null,
          apy7d: v.analytics?.apy7d ?? null,
          apy30d: v.analytics?.apy30d ?? null,
          tvl: v.analytics?.tvl?.usd ?? '0',
        },
        isRedeemable: v.isRedeemable,
      }));

    // Sort by APY descending
    vaults.sort(
      (a: any, b: any) =>
        (b.analytics.apy.total || 0) - (a.analytics.apy.total || 0)
    );

    return NextResponse.json({ vaults, total: vaults.length });
  } catch (error) {
    console.error('Error fetching vaults:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
