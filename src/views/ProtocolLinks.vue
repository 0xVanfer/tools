<template>
    <div class="protocol-links">
        <PageHeader title="Protocol Links" description="Directory of DeFi protocols and tools organized by category" />

        <div class="protocols-container">
            <!-- Search and Filter -->
            <div class="filter-section">
                <SearchInput v-model="searchQuery" placeholder="Search protocols..." />

                <div class="category-tabs">
                    <button class="category-tab" :class="{ active: selectedCategory === '' }" @click="selectedCategory = ''">All</button>
                    <button
                        v-for="category in categories"
                        :key="category"
                        class="category-tab"
                        :class="{ active: selectedCategory === category }"
                        @click="selectedCategory = category"
                    >
                        {{ category }}
                    </button>
                </div>
            </div>

            <!-- Protocols Grid -->
            <div class="protocols-grid mt-6">
                <a
                    v-for="protocol in filteredProtocols"
                    :key="protocol.name"
                    :href="protocol.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="protocol-card"
                >
                    <div class="protocol-header">
                        <span class="protocol-icon">{{ protocol.icon || "🔗" }}</span>
                        <div class="protocol-info">
                            <span class="protocol-name">{{ protocol.name }}</span>
                            <span class="protocol-category badge">{{ protocol.category }}</span>
                        </div>
                    </div>
                    <p class="protocol-desc">{{ protocol.description }}</p>
                    <div class="protocol-chains" v-if="protocol.chains">
                        <span v-for="chain in protocol.chains.slice(0, 5)" :key="chain" class="chain-badge">
                            {{ chain }}
                        </span>
                        <span v-if="protocol.chains.length > 5" class="chain-badge more"> +{{ protocol.chains.length - 5 }} </span>
                    </div>
                </a>
            </div>

            <!-- Empty State -->
            <EmptyState
                v-if="filteredProtocols.length === 0"
                icon="🔗"
                title="No protocols found"
                description="Try a different search term or category"
                class="mt-6"
            />
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { PageHeader, SearchInput, EmptyState } from "@/components";

const searchQuery = ref("");
const selectedCategory = ref("");

// Protocol data
const protocols = [
    // DEX
    {
        name: "Uniswap",
        url: "https://app.uniswap.org",
        category: "DEX",
        icon: "🦄",
        description: "Leading decentralized exchange with automated market making",
        chains: ["Ethereum", "Polygon", "Arbitrum", "Optimism", "Base"],
    },
    {
        name: "SushiSwap",
        url: "https://www.sushi.com",
        category: "DEX",
        icon: "🍣",
        description: "Multi-chain DEX with yield farming and lending",
        chains: ["Ethereum", "Polygon", "Arbitrum", "Fantom"],
    },
    {
        name: "Curve",
        url: "https://curve.fi",
        category: "DEX",
        icon: "🌀",
        description: "Stablecoin and wrapped asset exchange",
        chains: ["Ethereum", "Polygon", "Arbitrum", "Fantom"],
    },
    {
        name: "Balancer",
        url: "https://app.balancer.fi",
        category: "DEX",
        icon: "⚖️",
        description: "Programmable liquidity pools",
        chains: ["Ethereum", "Polygon", "Arbitrum"],
    },
    {
        name: "PancakeSwap",
        url: "https://pancakeswap.finance",
        category: "DEX",
        icon: "🥞",
        description: "BSC native DEX with lottery and NFTs",
        chains: ["BSC", "Ethereum", "Arbitrum"],
    },
    {
        name: "1inch",
        url: "https://app.1inch.io",
        category: "DEX",
        icon: "🦄",
        description: "DEX aggregator for best swap rates",
        chains: ["Ethereum", "Polygon", "BSC", "Arbitrum", "Optimism"],
    },

    // Lending
    {
        name: "Aave",
        url: "https://app.aave.com",
        category: "Lending",
        icon: "👻",
        description: "Decentralized lending and borrowing protocol",
        chains: ["Ethereum", "Polygon", "Arbitrum", "Optimism", "Avalanche"],
    },
    {
        name: "Compound",
        url: "https://app.compound.finance",
        category: "Lending",
        icon: "🏦",
        description: "Algorithmic money markets",
        chains: ["Ethereum", "Polygon"],
    },
    {
        name: "MakerDAO",
        url: "https://oasis.app",
        category: "Lending",
        icon: "🏛️",
        description: "DAI stablecoin and collateralized debt positions",
        chains: ["Ethereum"],
    },
    {
        name: "Morpho",
        url: "https://app.morpho.xyz",
        category: "Lending",
        icon: "🦋",
        description: "Optimized lending rates through P2P matching",
        chains: ["Ethereum"],
    },

    // Yield
    {
        name: "Yearn",
        url: "https://yearn.fi",
        category: "Yield",
        icon: "💎",
        description: "Yield optimization vaults",
        chains: ["Ethereum", "Fantom", "Arbitrum"],
    },
    { name: "Convex", url: "https://www.convexfinance.com", category: "Yield", icon: "⚡", description: "Boosted Curve rewards", chains: ["Ethereum"] },
    {
        name: "Beefy",
        url: "https://app.beefy.com",
        category: "Yield",
        icon: "🐄",
        description: "Multi-chain yield optimizer",
        chains: ["Ethereum", "Polygon", "BSC", "Arbitrum", "Optimism", "Fantom"],
    },

    // Bridges
    {
        name: "Stargate",
        url: "https://stargate.finance",
        category: "Bridge",
        icon: "🌉",
        description: "Native asset cross-chain bridge",
        chains: ["Ethereum", "Polygon", "BSC", "Arbitrum", "Optimism", "Avalanche"],
    },
    {
        name: "Hop Protocol",
        url: "https://app.hop.exchange",
        category: "Bridge",
        icon: "🐇",
        description: "Fast cross-chain token transfers",
        chains: ["Ethereum", "Polygon", "Arbitrum", "Optimism"],
    },
    {
        name: "Across",
        url: "https://across.to",
        category: "Bridge",
        icon: "🌊",
        description: "Capital efficient cross-chain bridge",
        chains: ["Ethereum", "Polygon", "Arbitrum", "Optimism"],
    },

    // Derivatives
    {
        name: "GMX",
        url: "https://app.gmx.io",
        category: "Derivatives",
        icon: "📈",
        description: "Decentralized perpetual exchange",
        chains: ["Arbitrum", "Avalanche"],
    },
    {
        name: "dYdX",
        url: "https://dydx.exchange",
        category: "Derivatives",
        icon: "📊",
        description: "Layer 2 perpetuals trading",
        chains: ["Ethereum", "dYdX Chain"],
    },
    {
        name: "Synthetix",
        url: "https://synthetix.io",
        category: "Derivatives",
        icon: "🔷",
        description: "Synthetic assets protocol",
        chains: ["Ethereum", "Optimism"],
    },

    // Tools
    {
        name: "Etherscan",
        url: "https://etherscan.io",
        category: "Tools",
        icon: "🔍",
        description: "Ethereum block explorer and analytics",
        chains: ["Ethereum"],
    },
    { name: "DeBank", url: "https://debank.com", category: "Tools", icon: "💼", description: "DeFi portfolio tracker", chains: ["Multi-chain"] },
    { name: "Zapper", url: "https://zapper.xyz", category: "Tools", icon: "⚡", description: "DeFi dashboard and investment manager", chains: ["Multi-chain"] },
    { name: "Revoke.cash", url: "https://revoke.cash", category: "Tools", icon: "🛡️", description: "Token approval manager", chains: ["Multi-chain"] },
    {
        name: "Chainlist",
        url: "https://chainlist.org",
        category: "Tools",
        icon: "📝",
        description: "EVM network list and RPC endpoints",
        chains: ["Multi-chain"],
    },

    // NFT
    {
        name: "OpenSea",
        url: "https://opensea.io",
        category: "NFT",
        icon: "🌊",
        description: "Largest NFT marketplace",
        chains: ["Ethereum", "Polygon", "Arbitrum"],
    },
    { name: "Blur", url: "https://blur.io", category: "NFT", icon: "💨", description: "NFT marketplace for pro traders", chains: ["Ethereum"] },
    { name: "LooksRare", url: "https://looksrare.org", category: "NFT", icon: "💎", description: "Community-first NFT marketplace", chains: ["Ethereum"] },

    // Governance
    { name: "Snapshot", url: "https://snapshot.org", category: "Governance", icon: "📸", description: "Off-chain voting platform", chains: ["Multi-chain"] },
    {
        name: "Tally",
        url: "https://www.tally.xyz",
        category: "Governance",
        icon: "🗳️",
        description: "On-chain governance platform",
        chains: ["Ethereum", "Polygon", "Arbitrum"],
    },
];

const categories = computed(() => {
    const cats = [...new Set(protocols.map((p) => p.category))];
    return cats.sort();
});

const filteredProtocols = computed(() => {
    let result = protocols;

    if (selectedCategory.value) {
        result = result.filter((p) => p.category === selectedCategory.value);
    }

    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        result = result.filter(
            (p) =>
                p.name.toLowerCase().includes(query) ||
                p.description.toLowerCase().includes(query) ||
                p.category.toLowerCase().includes(query) ||
                (p.chains && p.chains.some((c) => c.toLowerCase().includes(query))),
        );
    }

    return result;
});
</script>

<style scoped>
.protocols-container {
    max-width: 1200px;
}

.filter-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
}

.category-tabs {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
}

.category-tab {
    padding: var(--space-2) var(--space-3);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-full);
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    transition: all var(--transition-fast);
}

.category-tab:hover {
    background: var(--color-bg-hover);
}

.category-tab.active {
    background: var(--color-accent-primary);
    border-color: var(--color-accent-primary);
    color: var(--color-text-inverse);
}

.protocols-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--space-4);
}

.protocol-card {
    display: flex;
    flex-direction: column;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-xl);
    padding: var(--space-5);
    text-decoration: none;
    color: inherit;
    transition: all var(--transition-fast);
}

.protocol-card:hover {
    border-color: var(--color-accent-primary);
    box-shadow: var(--shadow-lg);
    transform: translateY(-2px);
}

.protocol-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
}

.protocol-icon {
    font-size: 2rem;
}

.protocol-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
}

.protocol-name {
    font-weight: var(--font-semibold);
    font-size: var(--text-lg);
    color: var(--color-text-primary);
}

.protocol-category {
    font-size: var(--text-xs);
}

.protocol-desc {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    line-height: var(--line-relaxed);
    flex: 1;
    margin-bottom: var(--space-3);
}

.protocol-chains {
    display: flex;
    gap: var(--space-1);
    flex-wrap: wrap;
}

.chain-badge {
    font-size: var(--text-xs);
    padding: var(--space-1) var(--space-2);
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-sm);
    color: var(--color-text-tertiary);
}

.chain-badge.more {
    background: var(--color-accent-primary);
    color: var(--color-text-inverse);
}
</style>
