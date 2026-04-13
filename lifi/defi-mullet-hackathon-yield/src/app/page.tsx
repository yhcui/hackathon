'use client';

import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useSendTransaction, useSwitchChain } from 'wagmi';
import { parseUnits } from 'viem';

// Chain options
const CHAINS = [
  { id: 8453, name: 'Base', slug: 'base' },
  { id: 42161, name: 'Arbitrum', slug: 'arbitrum' },
  { id: 1, name: 'Ethereum', slug: 'ethereum' },
  { id: 10, name: 'Optimism', slug: 'optimism' },
  { id: 137, name: 'Polygon', slug: 'polygon' },
];

interface Vault {
  address: string;
  network: string;
  chainId: number;
  slug: string;
  name: string;
  protocol: { name: string; url: string };
  underlyingTokens: { address: string; symbol: string; decimals: number }[];
  tags: string[];
  analytics: {
    apy: { base: number; reward: number; total: number };
    apy1d: number | null;
    apy7d: number | null;
    apy30d: number | null;
    tvl: string;
  };
  isRedeemable: boolean;
}

export default function Home() {
  const { address, isConnected, chainId: walletChainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();

  // Step state
  const [step, setStep] = useState(1);
  const [selectedChain, setSelectedChain] = useState(CHAINS[0]);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVault, setSelectedVault] = useState<Vault | null>(null);
  const [amount, setAmount] = useState('');
  const [txStatus, setTxStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Step 1: Fetch vaults for selected chain
  const handleChainSelect = async (chain: typeof CHAINS[0]) => {
    setSelectedChain(chain);
    setLoading(true);
    setErrorMsg('');
    setVaults([]);

    try {
      const res = await fetch(`/api/vaults?chainId=${chain.id}`);
      const data = await res.json();
      if (data.error) {
        setErrorMsg(data.error);
      } else {
        setVaults(data.vaults || []);
      }
    } catch {
      setErrorMsg('Failed to fetch vaults');
    }
    setLoading(false);
  };

  // Step 2: Select vault and enter amount
  const handleVaultSelect = (vault: Vault) => {
    setSelectedVault(vault);
  };

  // Step 3: Execute deposit
  const handleDeposit = async () => {
    if (!selectedVault || !amount || !address) return;

    setTxStatus('loading');
    setErrorMsg('');

    try {
      const token = selectedVault.underlyingTokens[0];
      if (!token) {
        throw new Error('No underlying token found for this vault');
      }

      const decimals = token.decimals;
      const amountWei = parseUnits(amount, decimals);

      // Get quote from Composer via our API
      const res = await fetch(
        `/api/quote?fromChain=${selectedChain.id}&toChain=${selectedChain.id}&fromToken=${token.address}&toToken=${selectedVault.address}&fromAddress=${address}&toAddress=${address}&fromAmount=${amountWei.toString()}`
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.details || err.error || 'Failed to get quote');
      }

      const quote = await res.json();

      if (!quote.transactionRequest) {
        throw new Error('No transaction request in quote response');
      }

      const tx = quote.transactionRequest;

      // Switch to the correct chain if wallet is on a different chain
      const targetChainId = selectedVault.chainId;
      if (walletChainId !== targetChainId) {
        try {
          await switchChain({ chainId: targetChainId });
        } catch {
          throw new Error(
            `Please switch your wallet to ${
              CHAINS.find((c) => c.id === targetChainId)?.name || 'the target'
            } chain manually`
          );
        }
      }

      // Send transaction
      const hash = await sendTransactionAsync({
        to: tx.to as `0x${string}`,
        value: tx.value ? BigInt(tx.value) : undefined,
        data: tx.data as `0x${string}`,
        chainId: selectedVault.chainId,
      });

      setTxStatus('success');
      console.log('Transaction sent:', hash);
    } catch (err: any) {
      console.error(err);
      setTxStatus('error');
      setErrorMsg(err.message || 'Transaction failed');
    }
  };

  const formatTvl = (tvl: string) => {
    const num = parseFloat(tvl);
    if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              EarnFlow
            </h1>
            <p className="text-xs text-gray-400">One-click yield deposit</p>
          </div>
          <ConnectButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Step Indicators */}
        <div className="flex items-center justify-center mb-8 gap-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-4">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  s <= step
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-800 text-gray-500'
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`w-16 h-0.5 ${s < step ? 'bg-indigo-500' : 'bg-gray-800'}`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Labels */}
        <div className="flex justify-center gap-12 mb-8 -mt-4">
          <span className="text-xs text-gray-400">Select Chain</span>
          <span className="text-xs text-gray-400">Pick Vault</span>
          <span className="text-xs text-gray-400">Deposit</span>
        </div>

        {/* Step 1: Select Chain */}
        {step === 1 && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-lg font-semibold mb-4">
              Step 1: Select Chain
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              {CHAINS.map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => {
                    setSelectedChain(chain);
                    handleChainSelect(chain);
                  }}
                  className={`p-4 rounded-lg border transition-all text-center ${
                    selectedChain.id === chain.id
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="font-medium text-sm">{chain.name}</div>
                </button>
              ))}
            </div>

            {/* Loading state */}
            {loading && (
              <div className="text-center py-8 text-gray-400">
                Loading vaults...
              </div>
            )}

            {/* Error state */}
            {errorMsg && step === 1 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                {errorMsg}
              </div>
            )}

            {/* Vaults list */}
            {vaults.length > 0 && !loading && (
              <>
                <div className="text-sm text-gray-400 mb-3">
                  {vaults.length} vaults found (sorted by APY)
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {vaults.slice(0, 20).map((vault, i) => (
                    <button
                      key={vault.slug}
                      onClick={() => {
                        handleVaultSelect(vault);
                        setStep(2);
                      }}
                      className="w-full bg-gray-800 hover:bg-gray-750 rounded-lg p-4 flex items-center justify-between border border-gray-700 hover:border-indigo-500/50 transition-all text-left"
                    >
                      <div>
                        <div className="font-medium text-sm">
                          {vault.name}
                        </div>
                        <div className="text-xs text-gray-400">
                          {vault.protocol.name} · {vault.network}
                        </div>
                        <div className="flex gap-1 mt-1">
                          {vault.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-indigo-400">
                          {vault.analytics.apy.total?.toFixed(2) ?? '0.00'}%
                        </div>
                        <div className="text-xs text-gray-400">
                          TVL: {formatTvl(vault.analytics.tvl)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {vaults.length === 0 && !loading && (
              <div className="text-center py-8 text-gray-400 text-sm">
                No vaults found for this chain
              </div>
            )}
          </div>
        )}

        {/* Step 2: Enter Amount */}
        {step === 2 && selectedVault && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-lg font-semibold mb-4">
              Step 2: Enter Deposit Amount
            </h2>

            {/* Selected vault info */}
            <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium">{selectedVault.name}</div>
                  <div className="text-sm text-gray-400">
                    {selectedVault.protocol.name} · {selectedVault.network}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Token:{' '}
                    {selectedVault.underlyingTokens[0]?.symbol || 'Unknown'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-indigo-400">
                    {selectedVault.analytics.apy.total?.toFixed(2)}%
                  </div>
                  <div className="text-xs text-gray-400">
                    TVL: {formatTvl(selectedVault.analytics.tvl)}
                  </div>
                </div>
              </div>
            </div>

            {/* Amount input */}
            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2">
                Deposit Amount
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-4 pr-20 text-lg focus:border-indigo-500 focus:outline-none"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                  {selectedVault.underlyingTokens[0]?.symbol || 'Token'}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-all"
              >
                Back
              </button>
              <button
                onClick={() => amount && parseFloat(amount) > 0 && setStep(3)}
                disabled={!amount || parseFloat(amount) <= 0}
                className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition-all"
              >
                Review Deposit
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm & Deposit */}
        {step === 3 && selectedVault && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-lg font-semibold mb-4">
              Step 3: Confirm & Deposit
            </h2>

            {/* Summary */}
            <div className="bg-gray-800 rounded-lg p-4 mb-6 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Vault</span>
                <span className="font-medium">{selectedVault.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Protocol</span>
                <span>{selectedVault.protocol.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Chain</span>
                <span>{selectedVault.network}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Token</span>
                <span>
                  {selectedVault.underlyingTokens[0]?.symbol || 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Amount</span>
                <span className="font-bold">{amount}</span>
              </div>
              <div className="flex justify-between border-t border-gray-700 pt-3">
                <span className="text-gray-400">Expected APY</span>
                <span className="text-indigo-400 font-bold">
                  {selectedVault.analytics.apy.total?.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Connect wallet warning */}
            {!isConnected && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-yellow-400 text-sm mb-4">
                Please connect your wallet first
              </div>
            )}

            {/* Error message */}
            {txStatus === 'error' && errorMsg && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm mb-4">
                {errorMsg}
              </div>
            )}

            {/* Success message */}
            {txStatus === 'success' && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-green-400 text-sm mb-4">
                Deposit transaction submitted! Check your wallet for
                confirmation.
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                disabled={txStatus === 'loading'}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg transition-all"
              >
                Back
              </button>
              <button
                onClick={handleDeposit}
                disabled={
                  txStatus === 'loading' ||
                  !isConnected ||
                  !amount ||
                  parseFloat(amount) <= 0
                }
                className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition-all"
              >
                {txStatus === 'loading'
                  ? 'Building Transaction...'
                  : txStatus === 'success'
                    ? 'Transaction Sent!'
                    : 'Deposit'}
              </button>
            </div>
          </div>
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
