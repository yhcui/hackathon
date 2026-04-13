/**
 * API 路由：/api/quote
 *
 * 这是一个 Next.js Server Route（服务端 API）。
 * 对应前端请求：GET /api/quote?fromChain=...&toChain=...&fromToken=...&toToken=...&fromAddress=...&toAddress=...&fromAmount=...
 *
 * 它作为代理，将请求转发到 LI.FI Composer API 的 /v1/quote 端点。
 *
 * LI.FI Quote API 的作用：
 * 给定源链、目标链、源代币、目标代币和金额，自动寻找最优的跨链/兑换路径，
 * 返回一个可以执行的交易对象（transactionRequest）。
 *
 * 注意：fromAmount 必须是最小代币单位的整数字符串（wei），例如：
 *   1 ETH (18 位精度) → "1000000000000000000"
 *   10 USDC (6 位精度) → "10000000"
 */

import { NextRequest, NextResponse } from 'next/server';

// LI.FI Composer API 的域名
const COMPOSER_API = 'https://li.quest';

export async function GET(request: NextRequest) {
  // 从 URL query 中提取所有必需参数
  const { searchParams } = request.nextUrl;

  const fromChain = searchParams.get('fromChain');      // 源链 ID（数字），如 8453 (Base)
  const toChain = searchParams.get('toChain');           // 目标链 ID
  const fromToken = searchParams.get('fromToken');       // 源代币合约地址
  const toToken = searchParams.get('toToken');           // 目标代币合约地址（金库地址）
  const fromAddress = searchParams.get('fromAddress');   // 用户钱包地址（源链）
  const toAddress = searchParams.get('toAddress');       // 接收地址（默认同 fromAddress）
  const fromAmount = searchParams.get('fromAmount');     // 金额（wei 单位，字符串）

  // 参数校验：这些参数都是必需的
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
    // 构建查询字符串，如果 toAddress 未传则复用 fromAddress
    const params = new URLSearchParams({
      fromChain,
      toChain: toChain || fromChain,
      fromToken,
      toToken,
      fromAddress,
      toAddress: toAddress || fromAddress,
      fromAmount,
    });

    // 调用 LI.FI Quote API
    const url = `${COMPOSER_API}/v1/quote?${params.toString()}`;
    const res = await fetch(url);

    if (!res.ok) {
      // API 返回非 200 状态码，把错误信息透传给前端
      const errorText = await res.text();
      return NextResponse.json(
        { error: 'Composer request failed', details: errorText },
        { status: res.status }
      );
    }

    // 解析并返回 quote 数据（包含 transactionRequest，即要发送的交易）
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
