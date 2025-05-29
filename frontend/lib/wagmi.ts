// Mock wagmi configuration for demonstration
export const config = {
  chains: [
    { id: 1, name: "Ethereum" },
    { id: 11155111, name: "Sepolia" },
  ],
  connectors: [
    { id: "injected", name: "MetaMask" },
    { id: "walletConnect", name: "WalletConnect" },
  ],
}

// Mock hooks for demonstration
export const useAccount = () => ({
  address: "0x1234567890123456789012345678901234567890",
  isConnected: false,
})

export const useConnect = () => ({
  connect: (connector: any) => console.log("Connecting to", connector.name),
  connectors: config.connectors,
  isPending: false,
})

export const useDisconnect = () => ({
  disconnect: () => console.log("Disconnecting wallet"),
})

export const useSignMessage = () => ({
  signMessageAsync: async ({ message }: { message: string }) => {
    // Mock signature for demonstration
    return "0xmocksignature1234567890abcdef"
  },
})
