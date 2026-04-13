'use client';

/**
 * wagmi 配置
 *
 * 这是整个 Web3 功能的基石。它做了三件事：
 * 1. 配置 wagmi —— 连接以太坊链的 React Hooks 库
 * 2. 配置 React Query —— 负责数据缓存和请求
 * 3. 配置 RainbowKit —— 提供钱包连接 UI
 *
 * 这三个库组合在一起是 React 上开发 dApp 的标准方案：
 *   wagmi（链交互）→ React Query（数据管理）→ RainbowKit（钱包 UI）
 */

import '@rainbow-me/rainbowkit/styles.css';
import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { base, arbitrum, mainnet, optimism, polygon } from 'wagmi/chains';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';

/**
 * wagmi 配置
 *
 * chains: 支持哪些区块链
 * transports: 如何连接这些链。http() 表示使用公共 RPC 端点
 *   生产环境应该替换为 Alchemy / Infura 等私有 RPC，例如：
 *   http(`https://mainnet.infura.io/v3/${INFURA_KEY}`)
 */
export const wagmiConfig = createConfig({
  chains: [base, arbitrum, mainnet, optimism, polygon],
  transports: {
    [base.id]: http(),
    [arbitrum.id]: http(),
    [mainnet.id]: http(),
    [optimism.id]: http(),
    [polygon.id]: http(),
  },
});

/**
 * React Query 客户端
 *
 * wagmi 底层用 React Query 管理数据（余额、链状态等）。
 * 它提供缓存、自动重试、后台刷新等功能。
 */
const queryClient = new QueryClient();

/**
 * Providers 组件
 *
 * 这是一个"Provider 壳层"组件，包裹了整个应用，
 * 为所有子组件提供 wagmi + React Query + RainbowKit 的上下文。
 *
 * 在 layout.tsx 中，所有页面都被 <Providers> 包裹，
 * 这样任何页面都可以直接使用 wagmi hooks（如 useAccount, useBalance 等）。
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#6366f1',
            borderRadius: 'medium',
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
