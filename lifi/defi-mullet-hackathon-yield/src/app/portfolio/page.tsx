'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

interface DepositRecord {
  id: number;
  address: string;
  chainId: number;
  vaultAddress: string;
  protocolName: string;
  vaultName: string;
  network: string;
  depositedAmountUsd: number;
  tokenSymbol: string;
  tokenAmount: string;
  timestamp: number;
}

interface Position {
  chainId: number;
  protocolName: string;
  asset: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
  };
  lpTokens: any[];
  balanceUsd: string;
  balanceNative: string;
}

interface MergedPosition {
  chainId: number;
  protocolName: string;
  network: string;
  asset: {
    address: string;
    symbol: string;
  };
  balanceUsd: number;
  balanceNative: string;
  depositedUsd: number;
  tokenSymbol: string;
  tokenAmount: string;
  yieldUsd: number;
  yieldPercent: number;
  hasBaseline: boolean;
}

const CHAINS: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  137: 'Polygon',
  42161: 'Arbitrum',
  8453: 'Base',
  11155111: 'Sepolia',
  11155420: 'Optimism Sepolia',
  80002: 'Polygon Amoy',
  84532: 'Base Sepolia',
  421614: 'Arbitrum Sepolia',
};

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  const [positions, setPositions] = useState<Position[]>([]);
  const [baselines, setBaselines] = useState<DepositRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchPortfolio = async () => {
    if (!address) return;

    setLoading(true);
    setError('');

    try {
      const [portfolioRes, depositRes] = await Promise.all([
        fetch(`/api/portfolio?address=${address}`, { cache: 'no-store' }),
        fetch(`/api/deposit-record?address=${address}`, { cache: 'no-store' }),
      ]);

      const portfolioData = await portfolioRes.json();
      if (portfolioData.error) {
        setError(portfolioData.error);
      } else {
        setPositions(portfolioData.positions || []);
      }

      const depositData = await depositRes.json();
      setBaselines(depositData.records || []);
    } catch {
      setError('Failed to fetch portfolio');
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchPortfolio();
  }, [address]);

  const mergedPositions: MergedPosition[] = positions.map((pos) => {
    // Find matching baselines by chainId + token symbol
    const matchingBaselines = baselines.filter(
      (b) =>
        b.chainId === pos.chainId &&
        b.tokenSymbol.toLowerCase() === pos.asset.symbol.toLowerCase()
    );

    const totalDepositedUsd = matchingBaselines.reduce(
      (sum, b) => sum + b.depositedAmountUsd,
      0
    );
    const balanceUsd = parseFloat(pos.balanceUsd) || 0;
    const yieldUsd = totalDepositedUsd > 0 ? balanceUsd - totalDepositedUsd : 0;
    const yieldPercent =
      totalDepositedUsd > 0 ? (yieldUsd / totalDepositedUsd) * 100 : 0;

    return {
      chainId: pos.chainId,
      protocolName: pos.protocolName,
      network: CHAINS[pos.chainId] || `Chain ${pos.chainId}`,
      asset: {
        address: pos.asset.address,
        symbol: pos.asset.symbol,
      },
      balanceUsd,
      balanceNative: pos.balanceNative,
      depositedUsd: totalDepositedUsd,
      tokenSymbol: pos.asset.symbol,
      tokenAmount: matchingBaselines
        .reduce((sum, b) => sum + parseFloat(b.tokenAmount || '0'), 0)
        .toFixed(6)
        .replace(/\.?0+$/, ''),
      yieldUsd,
      yieldPercent,
      hasBaseline: matchingBaselines.length > 0,
    };
  });

  const totalDeposited = mergedPositions.reduce((sum, p) => sum + p.depositedUsd, 0);
  const totalValue = mergedPositions.reduce((sum, p) => sum + p.balanceUsd, 0);
  const totalYield = totalValue - totalDeposited;

  const shortenAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const formatUsd = (val: number) => {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(2)}K`;
    return `$${val.toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                EarnFlow
              </h1>
              <p className="text-xs text-gray-400">My Portfolio</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {mounted && address && (
              <button
                onClick={fetchPortfolio}
                disabled={loading}
                className="text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                title="Refresh"
              >
                {loading ? (
                  <span className="text-gray-500">Loading...</span>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            )}
            <ConnectButton />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Not connected state */}
        {mounted && !isConnected && (
          <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 text-center">
            <div className="text-4xl mb-4">🔗</div>
            <h2 className="text-lg font-semibold mb-2">Connect Your Wallet</h2>
            <p className="text-gray-400 text-sm mb-4">
              Connect your wallet to view your vault positions and returns.
            </p>
            <ConnectButton />
          </div>
        )}

        {/* Loading state */}
        {mounted && isConnected && loading && (
          <div className="text-center py-16 text-gray-400">Loading portfolio...</div>
        )}

        {/* Error state */}
        {mounted && isConnected && error && !loading && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm text-center">
            {error}
            <button
              onClick={() => {
                if (address) {
                  setError('');
                  setLoading(true);
                  fetch(`/api/portfolio?address=${address}`)
                    .then((r) => r.json())
                    .then((d) => {
                      setPositions(d.positions || []);
                      setError(d.error || '');
                    })
                    .catch(() => setError('Failed to fetch portfolio'))
                    .finally(() => setLoading(false));
                }
              }}
              className="ml-2 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Portfolio content */}
        {mounted && isConnected && !loading && !error && (
          <>
            {/* Address badge */}
            {address && (
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Portfolio</h2>
                <span className="text-xs bg-gray-800 px-3 py-1.5 rounded-lg font-mono text-gray-400">
                  {shortenAddress(address)}
                </span>
              </div>
            )}

            {/* Empty state - no positions and no baselines */}
            {mergedPositions.length === 0 && baselines.length === 0 && (
              <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 text-center">
                <div className="text-4xl mb-4">💰</div>
                <h2 className="text-lg font-semibold mb-2">No Positions Found</h2>
                <p className="text-gray-400 text-sm mb-4">
                  You haven't deposited into any vaults yet. Make your first
                  deposit to start earning yield.
                </p>
                <Link
                  href="/"
                  className="inline-block px-6 py-3 bg-indigo-500 hover:bg-indigo-600 rounded-lg font-medium transition-all"
                >
                  Start Earning
                </Link>
              </div>
            )}

            {/* Show baselines when LI.FI hasn't indexed positions yet */}
            {mergedPositions.length === 0 && baselines.length > 0 && (
              <div className="bg-gray-900 rounded-xl p-8 border border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Deposit Records</h2>
                  <span className="text-xs text-gray-400">
                    LI.FI is indexing your positions, check back shortly
                  </span>
                </div>
                <div className="space-y-3">
                  {Object.entries(
                    baselines.reduce<Record<string, DepositRecord[]>>(
                      (acc, b) => {
                        const key = `${b.chainId}-${b.protocolName}-${b.vaultAddress}`;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(b);
                        return acc;
                      },
                      {}
                    )
                  ).map(([key, group]) => {
                    const totalAmount = group.reduce(
                      (sum, b) => sum + parseFloat(b.tokenAmount || '0'),
                      0
                    );
                    const b = group[0];
                    return (
                      <div
                        key={key}
                        className="bg-gray-800 rounded-lg p-4 border border-gray-700"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium">
                              {b.protocolName}
                              <span className="text-xs text-gray-500 ml-2">
                                {b.network}
                              </span>
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              Asset: {b.tokenSymbol} · {group.length} deposit{group.length > 1 ? 's' : ''}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold">
                              {totalAmount.toFixed(6)} {b.tokenSymbol}
                            </div>
                            <div className="text-xs text-gray-400">
                              Total Deposited
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Summary cards */}
            {mergedPositions.length > 0 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                    <div className="text-xs text-gray-400 mb-1">
                      Total Deposited
                    </div>
                    <div className="text-xl font-bold">
                      {totalDeposited > 0 ? formatUsd(totalDeposited) : '—'}
                    </div>
                  </div>
                  <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                    <div className="text-xs text-gray-400 mb-1">
                      Current Value
                    </div>
                    <div className="text-xl font-bold">
                      {totalValue > 0 ? formatUsd(totalValue) : '—'}
                    </div>
                  </div>
                  <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                    <div className="text-xs text-gray-400 mb-1">Total Yield</div>
                    <div
                      className={`text-xl font-bold ${
                        totalYield > 0
                          ? 'text-green-400'
                          : totalYield < 0
                            ? 'text-red-400'
                            : 'text-gray-400'
                      }`}
                    >
                      {totalDeposited > 0 ? (
                        <>
                          {totalYield > 0 ? '+' : ''}
                          {formatUsd(Math.abs(totalYield))}
                          <span className="text-sm ml-1">
                            ({totalYield >= 0 ? '+' : ''}
                            {(totalYield / (totalDeposited || 1)) * 100 > 0 ? '+' : ''}
                            {((totalYield / (totalDeposited || 1)) * 100).toFixed(2)}
                            %)
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </div>
                  </div>
                </div>

                {/* Position list */}
                <div className="space-y-3">
                  {mergedPositions.map((pos, i) => (
                    <div
                      key={`${pos.chainId}-${pos.asset.address}-${i}`}
                      className="bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-gray-700 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium">
                            {pos.protocolName}
                            <span className="text-xs text-gray-500 ml-2">
                              {pos.network}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            Asset: {pos.tokenSymbol}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">
                            {formatUsd(pos.balanceUsd)}
                          </div>
                          <div className="text-xs text-gray-400">
                            Current Value
                          </div>
                        </div>
                      </div>

                      {/* Details row */}
                      <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-gray-400 text-xs">Deposited</div>
                          <div className="font-medium mt-0.5">
                            {pos.hasBaseline
                              ? formatUsd(pos.depositedUsd)
                              : 'Not tracked'}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs">Yield (USD)</div>
                          <div
                            className={`font-medium mt-0.5 ${
                              !pos.hasBaseline
                                ? 'text-gray-500'
                                : pos.yieldUsd > 0
                                  ? 'text-green-400'
                                  : pos.yieldUsd < 0
                                    ? 'text-red-400'
                                    : 'text-gray-400'
                            }`}
                          >
                            {pos.hasBaseline ? (
                              <>
                                {pos.yieldUsd > 0 ? '+' : ''}
                                {formatUsd(Math.abs(pos.yieldUsd))}
                              </>
                            ) : (
                              '—'
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs">Yield %</div>
                          <div
                            className={`font-medium mt-0.5 ${
                              !pos.hasBaseline
                                ? 'text-gray-500'
                                : pos.yieldPercent > 0
                                  ? 'text-green-400'
                                  : pos.yieldPercent < 0
                                    ? 'text-red-400'
                                    : 'text-gray-400'
                            }`}
                          >
                            {pos.hasBaseline ? (
                              <>
                                {pos.yieldPercent > 0 ? '+' : ''}
                                {pos.yieldPercent.toFixed(2)}%
                              </>
                            ) : (
                              '—'
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs">
                            Token Amount
                          </div>
                          <div className="font-medium mt-0.5 text-xs">
                            {pos.tokenAmount || '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-xs text-gray-500">
          Built for DeFi Mullet Hackathon · Powered by{' '}
          <a
            href="https://li.fi"
            target="_blank"
            className="text-indigo-400 hover:underline"
          >
            LI.FI
          </a>{' '}
          Earn API
        </div>
      </main>
    </div>
  );
}
