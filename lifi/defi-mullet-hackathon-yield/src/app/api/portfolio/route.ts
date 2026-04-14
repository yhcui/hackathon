/**
 * API 路由：/api/portfolio
 *
 * 代理请求到 LI.FI Earn API 的 Portfolio 端点，
 * 用于查询用户在所有 vault 中的持仓（余额、USD 价值）。
 *
 * 请求示例：GET /api/portfolio?address=0x123...
 * 上游地址：https://earn.li.fi/v1/earn/portfolio/{address}/positions
 */

import { NextRequest, NextResponse } from 'next/server';

const EARN_API = 'https://earn.li.fi';

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');

  // 参数校验
  if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
    return NextResponse.json(
      { error: 'Valid wallet address required' },
      { status: 400 }
    );
  }

  try {
    const url = `${EARN_API}/v1/earn/portfolio/${address}/positions`;
    const res = await fetch(url, {
      next: { revalidate: 30 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch portfolio' },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ positions: data.positions || [] });
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
