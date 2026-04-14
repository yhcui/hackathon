/**
 * API 路由：/api/deposit-record
 *
 * 存款记录 API — 将用户存款信息存入服务器端 SQLite 数据库。
 * 替代原有的 localStorage 方案，数据不会因清除浏览器缓存而丢失。
 */

import { NextRequest, NextResponse } from 'next/server';
import { saveDepositRecord, getDepositRecordsByAddress } from '@/lib/db';

// POST /api/deposit-record — 保存一条存款记录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      address,
      chainId,
      vaultAddress,
      protocolName,
      vaultName,
      network,
      depositedAmountUsd,
      tokenSymbol,
      tokenAmount,
    } = body;

    if (!address || !chainId || !vaultAddress || !tokenSymbol || !tokenAmount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    saveDepositRecord({
      address,
      chainId,
      vaultAddress,
      protocolName: protocolName || 'Unknown',
      vaultName: vaultName || 'Unknown',
      network: network || 'Unknown',
      depositedAmountUsd: depositedAmountUsd || 0,
      tokenSymbol,
      tokenAmount,
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving deposit record:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/deposit-record?address=0x... — 获取某地址的所有存款记录
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');

  if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
    return NextResponse.json(
      { error: 'Valid wallet address required' },
      { status: 400 }
    );
  }

  try {
    const records = getDepositRecordsByAddress(address);
    return NextResponse.json({ records });
  } catch (error) {
    console.error('Error fetching deposit records:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
