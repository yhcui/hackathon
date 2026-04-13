/**
 * 主页面 —— 三步式收益存入流程
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  Step 1: 选择链     →  调用 /api/vaults 获取金库列表    │
 * │  Step 2: 输入金额   →  选择金库后输入存入数量            │
 * │  Step 3: 确认存入   →  调用 /api/quote 获取交易         │
 * │                      →  通过 wagmi 发送链上交易         │
 * └─────────────────────────────────────────────────────────┘
 *
 * 整个页面是一个 React 客户端组件（'use client'），
 * 意味着它在浏览器中运行，可以使用 useState 等 React hooks。
 *
 * 依赖的 Web3 库：
 *   wagmi      → 提供 React hooks 与以太坊链交互
 *   RainbowKit → 提供钱包连接按钮 UI
 *   viem       → 底层以太坊工具库（parseUnits 等）
 */

'use client';

import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useSendTransaction, useSwitchChain } from 'wagmi';
import { parseUnits } from 'viem';

/**
 * 支持的链列表
 *
 * id 是链的 chainId（如 Base = 8453），name 是显示名称。
 * 这些链必须也在 wagmi.tsx 的 chains 数组中注册过。
 */
/**
 * 支持的链列表（与 wagmi.tsx 保持一致）
 *
 * 通过环境变量 NEXT_PUBLIC_USE_TESTNET=true 自动切换为测试网
 */
const isTestnet = process.env.NEXT_PUBLIC_USE_TESTNET === 'true';

const CHAINS = isTestnet
  ? [
      { id: 84532, name: 'Base Sepolia', slug: 'base-sepolia' },
      { id: 421614, name: 'Arbitrum Sepolia', slug: 'arbitrum-sepolia' },
      { id: 11155111, name: 'Sepolia', slug: 'sepolia' },
      { id: 11155420, name: 'Optimism Sepolia', slug: 'optimism-sepolia' },
      { id: 80002, name: 'Polygon Amoy', slug: 'polygon-amoy' },
    ]
  : [
      { id: 8453, name: 'Base', slug: 'base' },
      { id: 42161, name: 'Arbitrum', slug: 'arbitrum' },
      { id: 1, name: 'Ethereum', slug: 'ethereum' },
      { id: 10, name: 'Optimism', slug: 'optimism' },
      { id: 137, name: 'Polygon', slug: 'polygon' },
    ];

/**
 * Vault（金库）数据结构
 *
 * 金库 = 一个可以存入并获取收益的 DeFi 协议中的资金池。
 * 这些数据来自 LI.FI Earn API，经由 /api/vaults 代理返回。
 */
interface Vault {
  address: string;                  // 金库合约地址，如 "0x1234..."
  network: string;                  // 网络名称，如 "Base"
  chainId: number;                  // 链 ID，如 8453
  slug: string;                     // 唯一标识
  name: string;                     // 金库名称
  protocol: { name: string; url: string };  // 协议信息
  underlyingTokens: { address: string; symbol: string; decimals: number }[];  // 底层代币
  tags: string[];                   // 标签
  analytics: {
    apy: { base: number; reward: number; total: number };  // APY（年化收益率）
    apy1d: number | null;
    apy7d: number | null;
    apy30d: number | null;
    tvl: string;                    // 锁仓总量（USD）
  };
  isRedeemable: boolean;            // 是否可赎回
}

export default function Home() {
  // ──────────────────────────────────────────
  // wagmi hooks
  // ──────────────────────────────────────────

  /** useAccount: 获取钱包信息 */
  const { address, isConnected, chainId: walletChainId } = useAccount();
  /** useSwitchChain: 切换链 */
  const { switchChain } = useSwitchChain();
  /** useSendTransaction: 发送普通交易（非合约调用） */
  const { sendTransactionAsync } = useSendTransaction();

  // ──────────────────────────────────────────
  // React 状态管理
  // ──────────────────────────────────────────

  /** 当前步骤：1 = 选链, 2 = 输入金额, 3 = 确认存入 */
  const [step, setStep] = useState(1);
  /** 当前选中的链 */
  const [selectedChain, setSelectedChain] = useState(CHAINS[0]);
  /** 金库列表（从 API 获取） */
  const [vaults, setVaults] = useState<Vault[]>([]);
  /** 是否正在加载金库列表 */
  const [loading, setLoading] = useState(false);
  /** 用户选中的金库 */
  const [selectedVault, setSelectedVault] = useState<Vault | null>(null);
  /** 用户输入的存入金额（人类可读值，如 "100.5"） */
  const [amount, setAmount] = useState('');
  /** 交易状态：idle = 空闲, loading = 处理中, success = 成功, error = 失败 */
  const [txStatus, setTxStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  /** 错误信息 */
  const [errorMsg, setErrorMsg] = useState('');

  // ──────────────────────────────────────────
  // Step 1: 选择链 → 获取该链上的金库列表
  // ──────────────────────────────────────────

  /**
   * 当用户选择链时触发
   * 1. 调用 /api/vaults?chainId=xxx 获取金库列表
   * 2. 将数据存储到 vaults 状态
   */
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

  // ──────────────────────────────────────────
  // Step 2: 选择金库 → 进入金额输入
  // ──────────────────────────────────────────

  /**
   * 当用户点击某个金库时触发
   * 记录选中的金库，并跳转到 Step 2
   */
  const handleVaultSelect = (vault: Vault) => {
    setSelectedVault(vault);
  };

  // ──────────────────────────────────────────
  // Step 3: 确认存入 → 获取报价 → 发送交易
  // ──────────────────────────────────────────

  /**
   * 执行存入操作，这是整个流程的核心：
   *
   * 1. 获取金库的底层代币信息
   * 2. 将用户输入的人类可读金额（如 "1.5"）转为 wei（如 "1500000000000000000"）
   * 3. 调用 /api/quote 获取 LI.FI 的交易报价
   * 4. 从报价中提取 transactionRequest
   * 5. 如果钱包不在目标链上，触发切换链
   * 6. 通过 wagmi 的 sendTransactionAsync 发送交易上链
   */
  const handleDeposit = async () => {
    if (!selectedVault || !amount || !address) return;

    setTxStatus('loading');
    setErrorMsg('');

    try {
      // 获取金库的底层代币（通常是存入该金库需要的代币）
      const token = selectedVault.underlyingTokens[0];
      if (!token) {
        throw new Error('No underlying token found for this vault');
      }

      // 将人类可读金额转为 wei
      // 例如：parseUnits("1.5", 18) → 1500000000000000000n
      const decimals = token.decimals;
      const amountWei = parseUnits(amount, decimals);

      // 调用 /api/quote 获取 LI.FI 的交易报价
      const res = await fetch(
        `/api/quote?fromChain=${selectedChain.id}&toChain=${selectedChain.id}&fromToken=${token.address}&toToken=${selectedVault.address}&fromAddress=${address}&toAddress=${address}&fromAmount=${amountWei.toString()}`
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.details || err.error || 'Failed to get quote');
      }

      const quote = await res.json();

      // 报价中必须包含 transactionRequest 才能执行交易
      if (!quote.transactionRequest) {
        throw new Error('No transaction request in quote response');
      }

      const tx = quote.transactionRequest;

      // 如果钱包连接的链不是目标链，尝试自动切换
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

      // 发送交易到区块链
      // to: 交易目标地址（LI.FI 路由合约）
      // value: 发送的 ETH 数量（如果是 ERC20 代币则为 undefined）
      // data: 交易数据（包含合约方法调用和参数）
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

      // 识别用户主动拒绝交易的情况
      const msg = err.message || err.details || '';
      if (
        msg.includes('user rejected') ||
        msg.includes('User denied') ||
        msg.includes('user denied') ||
        msg.includes('rejected the request') ||
        err.code === 4001 ||
        err.code === 'ACTION_REJECTED'
      ) {
        setErrorMsg('Transaction cancelled. You rejected the request in your wallet.');
      } else {
        setErrorMsg(err.message || 'Transaction failed');
      }
    }
  };

  /**
   * 将 TVL 数字格式化为人类可读的形式
   * 如 "1234567890" → "$1.2B"
   */
  const formatTvl = (tvl: string) => {
    const num = parseFloat(tvl);
    if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
  };

  // ──────────────────────────────────────────
  // UI 渲染
  // ──────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header: 项目名 + 钱包连接按钮 */}
      <header className="border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              EarnFlow
            </h1>
            <p className="text-xs text-gray-400">One-click yield deposit</p>
          </div>
          {/* RainbowKit 提供的钱包连接按钮 */}
          <ConnectButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* 步骤指示器: 三个圆点 + 连接线 */}
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

        {/* 步骤文字标签 */}
        <div className="flex justify-center gap-12 mb-8 -mt-4">
          <span className="text-xs text-gray-400">Select Chain</span>
          <span className="text-xs text-gray-400">Pick Vault</span>
          <span className="text-xs text-gray-400">Deposit</span>
        </div>

        {/* ──────────────────────────────────────── */}
        {/* Step 1: 选择链 */}
        {/* ──────────────────────────────────────── */}
        {step === 1 && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-lg font-semibold mb-4">
              Step 1: Select Chain
            </h2>

            {/* 链选择按钮网格 */}
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

            {/* 加载中状态 */}
            {loading && (
              <div className="text-center py-8 text-gray-400">
                Loading vaults...
              </div>
            )}

            {/* 错误状态 */}
            {errorMsg && step === 1 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                {errorMsg}
              </div>
            )}

            {/* 金库列表（最多显示前 20 个） */}
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
                        setErrorMsg('');
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

            {/* 无金库状态 */}
            {vaults.length === 0 && !loading && (
              <div className="text-center py-8 text-gray-400 text-sm">
                No vaults found for this chain
              </div>
            )}
          </div>
        )}

        {/* ──────────────────────────────────────── */}
        {/* Step 2: 输入金额 */}
        {/* ──────────────────────────────────────── */}
        {step === 2 && selectedVault && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-lg font-semibold mb-4">
              Step 2: Enter Deposit Amount
            </h2>

            {/* 显示选中金库的信息 */}
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

            {/* 金额输入框 */}
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
                {/* 右侧显示代币符号 */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                  {selectedVault.underlyingTokens[0]?.symbol || 'Token'}
                </div>
              </div>
            </div>

            {/* 返回 / 下一步按钮 */}
            <div className="flex gap-3">
              <button
                onClick={() => { setErrorMsg(''); setTxStatus('idle'); setStep(1) }}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-all"
              >
                Back
              </button>
              <button
                onClick={() => { setErrorMsg(''); setTxStatus('idle'); amount && parseFloat(amount) > 0 && setStep(3) }}
                disabled={!amount || parseFloat(amount) <= 0}
                className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition-all"
              >
                Review Deposit
              </button>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────── */}
        {/* Step 3: 确认 & 存入 */}
        {/* ──────────────────────────────────────── */}
        {step === 3 && selectedVault && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-lg font-semibold mb-4">
              Step 3: Confirm & Deposit
            </h2>

            {/* 存入信息汇总 */}
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

            {/* 钱包未连接警告 */}
            {!isConnected && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-yellow-400 text-sm mb-4">
                Please connect your wallet first
              </div>
            )}

            {/* 错误信息 */}
            {txStatus === 'error' && errorMsg && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm mb-4">
                {errorMsg}
              </div>
            )}

            {/* 成功信息 */}
            {txStatus === 'success' && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-green-400 text-sm mb-4">
                Deposit transaction submitted! Check your wallet for
                confirmation.
              </div>
            )}

            {/* 返回 / 执行存入按钮 */}
            <div className="flex gap-3">
              <button
                onClick={() => { setErrorMsg(''); setTxStatus('idle'); setStep(2) }}
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
