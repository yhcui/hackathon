/**
 * API 路由：/api/vaults
 *
 * 这是一个 Next.js Server Route（服务端 API）。
 * 对应前端的请求：GET /api/vaults?chainId=8453
 *
 * 它作为代理，转发请求到 LI.FI Earn API，并对返回数据做过滤和排序。
 *
 * 为什么需要代理而不是前端直接请求 LI.FI？
 * 1. 隐藏 API 实现细节
 * 2. 可以加缓存、限流、数据清洗等中间处理
 * 3. 避免 CORS 问题
 */

import { NextRequest, NextResponse } from 'next/server';

// LI.FI Earn API 的域名（专门用于收益金库查询）
const EARN_API = 'https://earn.li.fi';

export async function GET(request: NextRequest) {
  // 从 URL query 中获取 chainId 参数（如 ?chainId=8453）
  const { searchParams } = request.nextUrl;
  const chainId = searchParams.get('chainId');

  try {
    // 构建转发给 LI.FI Earn API 的查询参数
    const params = new URLSearchParams();
    if (chainId) params.set('chainId', chainId);

    const url = `${EARN_API}/v1/earn/vaults?${params.toString()}`;
    const res = await fetch(url, {
      // ISR（增量静态再生成）：缓存 60 秒，之后自动刷新
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch vaults' },
        { status: res.status }
      );
    }

    const data = await res.json();

    // 数据清洗：只保留可交易的 vault，并精简返回的字段
    const vaults = (data.data || [])
      // isTransactional = true 表示该金库可以实际执行存入/取出操作
      .filter((v: any) => v.isTransactional === true)
      .map((v: any) => ({
        address: v.address,                        // 金库合约地址
        network: v.network,                         // 网络名称，如 "Base"
        chainId: v.chainId,                         // 链 ID，如 8453
        slug: v.slug,                               // 唯一标识符
        name: v.name,                               // 金库名称
        protocol: v.protocol,                       // 协议信息 {name, url}
        underlyingTokens: v.underlyingTokens,       // 底层代币列表
        tags: v.tags,                               // 标签，如 "stablecoin"
        analytics: {
          apy: {
            base: v.analytics?.apy?.base ?? 0,      // 基础 APY
            reward: v.analytics?.apy?.reward ?? 0,  // 奖励 APY
            total: v.analytics?.apy?.total ?? 0,    // 总 APY
          },
          apy1d: v.analytics?.apy1d ?? null,        // 近 1 天 APY
          apy7d: v.analytics?.apy7d ?? null,        // 近 7 天 APY
          apy30d: v.analytics?.apy30d ?? null,      // 近 30 天 APY
          tvl: v.analytics?.tvl?.usd ?? '0',        // 锁仓总量（USD）
        },
        isRedeemable: v.isRedeemable,               // 是否可赎回
      }));

    // 按 APY 降序排列，高收益排在前面
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
