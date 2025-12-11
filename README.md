# Web3 Dashboard

A multi-chain Web3 wallet dashboard built with Nuxt 4, wagmi, viem, and Reown (WalletConnect).

## Features

- 🔗 **Multi-chain Support**: Ethereum, Polygon, Arbitrum, Base (mainnets + testnets)
- 👛 **Wallet Connection**: Connect via WalletConnect, MetaMask, Coinbase, and more
- 💰 **Token Balances**: View ERC20 token balances across chains
- 🌐 **Network Switching**: Easy switching between supported networks
- 📱 **Responsive Design**: Desktop sidebar, mobile bottom navigation

## Tech Stack

- **Framework**: Nuxt 4
- **Web3**: wagmi, viem, @reown/appkit
- **State**: @tanstack/vue-query
- **Styling**: CSS Variables, custom dark theme

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```env
# Reown (WalletConnect) Project ID - REQUIRED
# Get yours at https://cloud.reown.com
NUXT_REOWN_PROJECT_ID=your_project_id_here

# App URL - REQUIRED for production/staging
# Used for WalletConnect metadata. Falls back to http://localhost:3000 in development.
# HTTPS is automatically enforced in production (non-localhost URLs)
NUXT_APP_URL=https://your-production-domain.com

# Alchemy API Key (optional, for enhanced RPC)
# Get yours at https://alchemy.com
NUXT_ALCHEMY_API_KEY=your_alchemy_key_here
```

## Supported Networks

| Network          | Chain ID  | Type    |
|------------------|-----------|---------|
| Ethereum Mainnet | 1         | Mainnet |
| Sepolia          | 11155111  | Testnet |
| Polygon          | 137       | Mainnet |
| Polygon Amoy     | 80002     | Testnet |
| Arbitrum One     | 42161     | Mainnet |
| Arbitrum Sepolia | 421614    | Testnet |
| Base             | 8453      | Mainnet |
| Base Sepolia     | 84532     | Testnet |


Token balances are fetched directly from the blockchain using viem's public clients.

## License

MIT
