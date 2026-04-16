# EarnFlow 项目讲解

## 一、这个项目是做什么的？

**EarnFlow** 是一个"一键存入 DeFi 赚取收益"的应用。

### 通俗理解

想象你去银行存钱，银行会给你利息。DeFi（去中心化金融）世界也有类似的"银行"——比如 Aave、Morpho、Euler 这些协议。你把加密货币存进去，就能赚取利息（收益）。

但传统流程很麻烦：
1. 选区块链（以太坊？Base？Arbitrum？）
2. 找哪个"银行"利息高
3. 授权代币
4. 执行存入操作

**EarnFlow 把这一套流程简化成了 3 步引导**：选链 → 选产品 → 确认存入。

### 背景

这是为 **DeFi Mullet Hackathon**（一个 DeFi 黑客松比赛）做的项目，使用了 **LI.FI** 的基础设施。LI.FI 是一个跨链桥和 DEX 聚合平台，提供了查找收益金库、获取报价、查看投资组合等 API。

> "Mullet" 不是技术术语，只是这个黑客松的名字/品牌。

---

## 二、核心功能

### 1. 三步存入流程

| 步骤 | 内容 |
|------|------|
| 第一步 | 选择区块链（Base、Arbitrum、以太坊、Optimism、Polygon） |
| 第二步 | 选择一个金库（Vault），输入存入金额 |
| 第三步 | 确认信息，提交交易 |

### 2. 金库发现

通过 LI.FI 的 API 获取各个链上提供收益的金库，按收益率（APY）或总锁仓量（TVL）排序，只显示真实可用的交易型金库。

### 3. 两种存入模式

- **直接存入（默认）**：直接调用金库合约，gas 费低
- **LI.FI 路由存入**：支持跨链和兑换，但 gas 费高一些

### 4. 投资组合面板

`/portfolio` 页面展示你在各个金库中的持仓，计算收益（美元和百分比）。

### 5. 存入记录持久化

用服务器端的 SQLite 数据库保存存入记录，替代了浏览器 localStorage，即使清缓存数据也不会丢。

---

## 三、技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 16（App Router） |
| 语言 | TypeScript 5, React 19 |
| 样式 | Tailwind CSS v4 |
| 钱包连接 | RainbowKit + wagmi + viem |
| 数据获取 | TanStack React Query |
| 数据库 | SQLite（Node.js 内置，无需额外安装） |

### 一个关键特点

**没有使用外部数据库**（不需要 MySQL、PostgreSQL 等）。用的是 Node.js 内置的 SQLite 模块，零依赖。

---

## 四、文件结构

```
defi-mullet-hackathon-yield/
├── .env.local                    # 环境变量配置
├── next.config.ts                # Next.js 配置（standalone 模式）
├── package.json                  # 依赖和脚本
├── data/
│   └── earnflow.db               # SQLite 数据库文件（自动生成）
├── src/
│   ├── app/
│   │   ├── layout.tsx            # 根布局
│   │   ├── page.tsx              # 主页：三步存入流程
│   │   ├── api/                  # 后端 API 路由
│   │   │   ├── vaults/route.ts   # 获取金库列表
│   │   │   ├── quote/route.ts    # 获取报价/路由
│   │   │   ├── portfolio/route.ts # 获取投资组合
│   │   │   └── deposit-record/route.ts # 存入记录的增删查
│   │   └── portfolio/
│   │       └── page.tsx          # 投资组合面板
│   ├── config/
│   │   └── wagmi.tsx             # 钱包连接配置
│   └── lib/
│       └── db.ts                 # 数据库操作（建表、存、查）
└── public/                       # 静态资源（图标等）
```

---

## 五、数据库详解

### 5.1 数据库类型：SQLite

SQLite 是一个**基于文件的数据库**。整个数据库就是一个文件（`earnflow.db`），不需要安装任何数据库服务。

### 5.2 表结构

只有一张表：`deposit_records`（存入记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | 整数，自增主键 | 记录编号 |
| `address` | 文本，不为空 | 用户钱包地址（已建索引） |
| `chainId` | 整数，不为空 | 区块链的链 ID |
| `vaultAddress` | 文本，不为空 | 金库合约地址 |
| `protocolName` | 文本，不为空 | 协议名称（如 "Aave"） |
| `vaultName` | 文本，不为空 | 金库名称 |
| `network` | 文本，不为空 | 网络名称（如 "Base"） |
| `depositedAmountUsd` | 浮点数 | 存入时的美元价值 |
| `tokenSymbol` | 文本，不为空 | 代币符号（如 "USDC"） |
| `tokenAmount` | 文本，不为空 | 存入的代币数量 |
| `timestamp` | 整数，不为空 | 存入时间的 Unix 时间戳 |

### 5.3 SQLite 的辅助文件

SQLite 运行时会生成两个辅助文件：

| 文件 | 作用 |
|------|------|
| `earnflow.db` | **主数据库文件** |
| `earnflow.db-shm` | 共享内存文件，用于多进程协调访问 |
| `earnflow.db-wal` | 预写日志文件，先写日志再同步到主文件，提高性能和安全性 |

**部署时这三个文件必须一起复制**，否则可能丢失最近的写入数据。

### 5.4 数据库路径

路径硬编码在 `src/lib/db.ts` 中：

```
process.cwd() + '/data/earnflow.db'
```

`process.cwd()` 返回的是**启动 Node.js 进程时的当前目录**。

---

## 六、部署说明

### 6.1 Standalone 模式

项目配置了 `output: 'standalone'`，`next build` 后会生成一个独立的部署包。

### 6.2 服务器目录结构

假设部署在 `/root/hack/standalone`：

```
/root/hack/standalone/
├── .next/standalone/     # Next.js 独立运行包
├── public/               # 静态文件
└── data/
    ├── earnflow.db       # 数据库主文件
    ├── earnflow.db-shm   # 共享内存文件
    └── earnflow.db-wal   # 预写日志文件
```

### 6.3 启动命令

```bash
cd /root/hack/standalone
node .next/standalone/server.js
```

**必须从 `/root/hack/standalone` 目录启动**，因为 `process.cwd()` 会指向当前目录，代码需要在这里找到 `data/earnflow.db`。

### 6.4 注意事项

- `data/` 目录需要有**写入权限**（SQLite 需要创建锁文件和 WAL 文件）
- 如果只复制了 `.next/standalone/` 而没有 `data/` 目录，代码会自动创建空目录，但**不会有已有数据**
- 三个数据库文件要**一起复制**

---

## 七、支持的区块链

| 网络 | 链 ID |
|------|-------|
| 以太坊 | 1 |
| Optimism | 10 |
| Polygon | 137 |
| Arbitrum | 42161 |
| Base | 8453 |

测试网通过 `NEXT_PUBLIC_USE_TESTNET` 环境变量切换。

---

## 八、工作流程图

```
用户打开页面
    ↓
连接钱包（RainbowKit）
    ↓
第一步：选择区块链
    ↓
第二步：调用 /api/vaults → LI.FI API 获取金库列表 → 用户选择金库
    ↓
第三步：如果开启直接存入 → 直接调用合约
       否则 → 调用 /api/quote → LI.FI API 获取路由
    ↓
用户确认 → 发送交易
    ↓
交易成功后 → 调用 /api/deposit-record (POST) → 存入 SQLite 数据库
    ↓
用户可在 /portfolio 页面查看持仓和收益
    ↓
/portfolio 调用 /api/portfolio → LI.FI API 获取当前持仓
         + 本地数据库的存入记录
         = 计算收益（当前价值 - 存入金额）
```
