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
        name: "Sushi",
        url: "https://www.sushi.com",
        category: "DEX",
        icon: "🍣",
        description: "Multi-chain DEX with yield farming and lending",
        chains: ["Ethereum", "Polygon", "Arbitrum", "Base"],
    },
    {
        name: "Curve",
        url: "https://www.curve.finance",
        category: "DEX",
        icon: "🌀",
        description: "Stablecoin and wrapped asset exchange",
        chains: ["Ethereum", "Polygon", "Arbitrum", "Base"],
    },
    {
        name: "Balancer",
        url: "https://balancer.fi",
        category: "DEX",
        icon: "⚖️",
        description: "Programmable liquidity pools",
        chains: ["Ethereum", "Polygon", "Arbitrum", "Base"],
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
        url: "https://1inch.com",
        category: "DEX",
        icon: "🦄",
        description: "DEX aggregator for best swap rates",
        chains: ["Ethereum", "Polygon", "BSC", "Arbitrum", "Optimism", "Base"],
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
        name: "Morpho",
        url: "https://app.morpho.org",
        category: "Lending",
        icon: "🦋",
        description: "Optimized lending rates through P2P matching",
        chains: ["Ethereum", "Base", "Arbitrum"],
    },
    {
        name: "Sky",
        url: "https://app.sky.money",
        category: "Lending",
        icon: "🌌",
        description: "Stablecoin credit protocol (formerly MakerDAO)",
        chains: ["Ethereum", "Base", "Arbitrum"],
    },

    // Yield
    { name: "Yearn", url: "https://yearn.fi", category: "Yield", icon: "💎", description: "Yield optimization vaults", chains: ["Ethereum", "Optimism", "Arbitrum", "Base"] },
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
        name: "Relay",
        url: "https://relay.link",
        category: "Bridge",
        icon: "⚡",
        description: "Fast, low-cost cross-chain transfers",
        chains: ["Ethereum", "Base", "Arbitrum", "Optimism"],
    },
    {
        name: "Across",
        url: "https://across.to",
        category: "Bridge",
        icon: "🌊",
        description: "Capital efficient cross-chain bridge",
        chains: ["Ethereum", "Polygon", "Arbitrum", "Optimism", "Base"],
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
        url: "https://www.dydx.xyz",
        category: "Derivatives",
        icon: "📊",
        description: "Decentralized perpetuals exchange",
        chains: ["dYdX Chain"],
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

    // ---------------------------------------------------------------------
    // DEX / aggregators
    // ---------------------------------------------------------------------
    { name: "CoW Swap", url: "https://swap.cow.fi", category: "DEX", icon: "🐮", description: "MEV-protected batch auction DEX", chains: ["Ethereum", "Gnosis", "Arbitrum", "Base"] },
    { name: "KyberSwap", url: "https://kyberswap.com", category: "DEX", icon: "🟢", description: "Multi-chain DEX and aggregator", chains: ["Ethereum", "Polygon", "BSC", "Arbitrum", "Base"] },
    { name: "Aerodrome", url: "https://aerodrome.finance", category: "DEX", icon: "✈️", description: "Base's central liquidity hub (veAERO)", chains: ["Base"] },
    { name: "Velodrome", url: "https://velodrome.finance", category: "DEX", icon: "🚴", description: "Optimism's central liquidity hub (veVELO)", chains: ["Optimism"] },
    { name: "Pendle", url: "https://app.pendle.finance", category: "DEX", icon: "⏳", description: "Yield tokenization and trading", chains: ["Ethereum", "Arbitrum", "Base"] },
    { name: "Fluid", url: "https://fluid.io", category: "DEX", icon: "💧", description: "Unified liquidity layer (formerly Instadapp)", chains: ["Ethereum", "Arbitrum", "Base"] },
    { name: "Maverick", url: "https://www.mav.xyz", category: "DEX", icon: "🐴", description: "Dynamic distribution AMM", chains: ["Ethereum", "BSC", "Base"] },
    { name: "Odos", url: "https://app.odos.xyz", category: "DEX", icon: "🧭", description: "Multi-token swap aggregator", chains: ["Ethereum", "Polygon", "Arbitrum", "Base"] },
    { name: "Ambient", url: "https://ambient.finance", category: "DEX", icon: "🌊", description: "Concentrated liquidity DEX on Scroll", chains: ["Scroll", "Ethereum"] },
    { name: "LFJ", url: "https://lfj.gg", category: "DEX", icon: "☕", description: "Liquidity marketplace (formerly Trader Joe)", chains: ["Avalanche", "Arbitrum", "Base"] },

    // ---------------------------------------------------------------------
    // Lending
    // ---------------------------------------------------------------------
    { name: "Spark", url: "https://app.spark.fi", category: "Lending", icon: "✨", description: "Sky's lending and savings protocol", chains: ["Ethereum", "Gnosis", "Base"] },
    { name: "Euler", url: "https://app.euler.finance", category: "Lending", icon: "🔺", description: "Permissionless lending vaults", chains: ["Ethereum", "Base"] },
    { name: "Silo", url: "https://app.silo.finance", category: "Lending", icon: "🌾", description: "Isolated lending markets", chains: ["Ethereum", "Arbitrum", "Sonic"] },
    { name: "Venus", url: "https://app.venus.io", category: "Lending", icon: "♀️", description: "BNB Chain money market", chains: ["BSC", "Ethereum", "Optimism"] },
    { name: "Dolomite", url: "https://app.dolomite.io", category: "Lending", icon: "🪨", description: "Margin trading and lending", chains: ["Ethereum", "Arbitrum", "Base"] },
    { name: "Ajna", url: "https://ajna.finance", category: "Lending", icon: "🎯", description: "Oracle-free permissionless lending", chains: ["Ethereum", "Base", "Arbitrum"] },

    // ---------------------------------------------------------------------
    // Liquid staking & restaking
    // ---------------------------------------------------------------------
    { name: "Lido", url: "https://stake.lido.fi", category: "Liquid Staking", icon: "🌊", description: "Liquid staking for ETH (stETH)", chains: ["Ethereum", "Arbitrum", "Base"] },
    { name: "Rocket Pool", url: "https://stake.rocketpool.net", category: "Liquid Staking", icon: "🚀", description: "Decentralized ETH staking (rETH)", chains: ["Ethereum", "Optimism", "Arbitrum"] },
    { name: "StakeWise", url: "https://app.stakewise.io", category: "Liquid Staking", icon: "🧠", description: "Vault-based ETH staking (osETH)", chains: ["Ethereum"] },
    { name: "EigenLayer", url: "https://www.eigenlayer.xyz", category: "Restaking", icon: "🔄", description: "Ethereum restaking and AVS security", chains: ["Ethereum"] },
    { name: "ether.fi", url: "https://app.ether.fi", category: "Restaking", icon: "💎", description: "Non-custodial ETH restaking (eETH)", chains: ["Ethereum", "Base", "Arbitrum"] },
    { name: "Renzo", url: "https://app.renzoprotocol.com", category: "Restaking", icon: "🛡️", description: "EigenLayer restaking (ezETH)", chains: ["Ethereum", "Arbitrum", "Base"] },
    { name: "Kelp DAO", url: "https://kelpdao.xyz", category: "Restaking", icon: "🌿", description: "Liquid restaking (rsETH)", chains: ["Ethereum", "Arbitrum", "Base"] },
    { name: "Puffer", url: "https://app.puffer.fi", category: "Restaking", icon: "🐡", description: "Based rollup + liquid restaking", chains: ["Ethereum"] },
    { name: "Symbiotic", url: "https://app.symbiotic.fi", category: "Restaking", icon: "🤝", description: "Permissionless shared security", chains: ["Ethereum"] },
    { name: "Karak", url: "https://app.karak.network", category: "Restaking", icon: "⚔️", description: "Universal restaking layer", chains: ["Ethereum", "Arbitrum"] },

    // ---------------------------------------------------------------------
    // Yield
    // ---------------------------------------------------------------------
    { name: "Gearbox", url: "https://app.gearbox.fi", category: "Yield", icon: "⚙️", description: "Composable leverage and credit accounts", chains: ["Ethereum", "Arbitrum"] },
    { name: "Harvest", url: "https://app.harvest.finance", category: "Yield", icon: "🌾", description: "Automated yield farming", chains: ["Ethereum", "Base", "Arbitrum"] },

    // ---------------------------------------------------------------------
    // Stablecoins
    // ---------------------------------------------------------------------
    { name: "Ethena", url: "https://app.ethena.fi", category: "Stablecoin", icon: "🧿", description: "Delta-neutral synthetic dollar (USDe)", chains: ["Ethereum", "Arbitrum", "Base"] },
    { name: "Liquity", url: "https://www.liquity.org", category: "Stablecoin", icon: "🏛️", description: "Interest-free CDP borrowing (LUSD/BOLD)", chains: ["Ethereum"] },
    { name: "Frax", url: "https://app.frax.finance", category: "Stablecoin", icon: "🧬", description: "FRAX stablecoin and frxETH", chains: ["Ethereum", "Fraxtal", "Arbitrum"] },
    { name: "Reserve", url: "https://app.reserve.org", category: "Stablecoin", icon: "💵", description: "Asset-backed stablecoin (RSR)", chains: ["Ethereum", "Base", "Arbitrum"] },
    { name: "Usual", url: "https://app.usual.money", category: "Stablecoin", icon: "🪙", description: "RWA-backed stablecoin (USD0)", chains: ["Ethereum"] },

    // ---------------------------------------------------------------------
    // Bridges
    // ---------------------------------------------------------------------
    { name: "LayerZero", url: "https://layerzero.network", category: "Bridge", icon: "🛰️", description: "Omnichain interoperability protocol", chains: ["Multi-chain"] },
    { name: "Wormhole", url: "https://wormhole.com", category: "Bridge", icon: "🕳️", description: "Cross-chain messaging protocol", chains: ["Multi-chain"] },
    { name: "deBridge", url: "https://app.debridge.finance", category: "Bridge", icon: "🌁", description: "Intent-based cross-chain swaps", chains: ["Multi-chain"] },
    { name: "Bungee", url: "https://bungee.exchange", category: "Bridge", icon: "🪢", description: "Bridge and swap aggregator", chains: ["Multi-chain"] },
    { name: "Orbiter", url: "https://orbiter.finance", category: "Bridge", icon: "🛸", description: "Rollup-to-rollup bridging", chains: ["Ethereum", "Arbitrum", "Optimism", "Base"] },
    { name: "Squid", url: "https://app.squidrouter.com", category: "Bridge", icon: "🦑", description: "Cross-chain swaps by Axelar", chains: ["Multi-chain"] },
    { name: "Jumper", url: "https://jumper.exchange", category: "Bridge", icon: "🏃", description: "LI.FI powered swap and bridge", chains: ["Multi-chain"] },

    // ---------------------------------------------------------------------
    // Derivatives
    // ---------------------------------------------------------------------
    { name: "Hyperliquid", url: "https://app.hyperliquid.xyz", category: "Derivatives", icon: "🔵", description: "On-chain perps and HyperEVM", chains: ["HyperEVM"] },
    { name: "Aevo", url: "https://app.aevo.xyz", category: "Derivatives", icon: "📉", description: "Options and perpetuals exchange", chains: ["Ethereum", "Optimism"] },
    { name: "Ostium", url: "https://ostium.io", category: "Derivatives", icon: "🎢", description: "On-chain macro and commodity perps", chains: ["Arbitrum", "Base"] },
    { name: "Gains Network", url: "https://gains.trade", category: "Derivatives", icon: "🎣", description: "Leveraged trading across assets", chains: ["Arbitrum", "Base"] },

    // ---------------------------------------------------------------------
    // Prediction markets
    // ---------------------------------------------------------------------
    { name: "Polymarket", url: "https://polymarket.com", category: "Prediction", icon: "🔮", description: "Largest prediction market", chains: ["Polygon"] },
    { name: "Azuro", url: "https://azuro.org", category: "Prediction", icon: "🎲", description: "On-chain sports betting liquidity", chains: ["Gnosis", "Polygon", "Base"] },
    { name: "Limitless", url: "https://limitless.exchange", category: "Prediction", icon: "🧮", description: "Short-term prediction markets", chains: ["Base"] },

    // ---------------------------------------------------------------------
    // NFT
    // ---------------------------------------------------------------------
    { name: "Magic Eden", url: "https://magiceden.io", category: "NFT", icon: "🪄", description: "Multi-chain NFT marketplace", chains: ["Ethereum", "Polygon", "Base"] },
    { name: "Zora", url: "https://zora.co", category: "NFT", icon: "🎨", description: "Onchain creation and minting", chains: ["Zora", "Base", "Ethereum"] },

    // ---------------------------------------------------------------------
    // Governance
    // ---------------------------------------------------------------------
    { name: "Boardroom", url: "https://boardroom.io", category: "Governance", icon: "🏢", description: "Governance data and voting", chains: ["Multi-chain"] },
    { name: "Karma", url: "https://www.karmahq.xyz", category: "Governance", icon: "🧘", description: "Delegate discovery and accountability", chains: ["Multi-chain"] },

    // ---------------------------------------------------------------------
    // Analytics & data
    // ---------------------------------------------------------------------
    { name: "DefiLlama", url: "https://defillama.com", category: "Analytics", icon: "🦙", description: "DeFi TVL and protocol data", chains: ["Multi-chain"] },
    { name: "Dune", url: "https://dune.com", category: "Analytics", icon: "📊", description: "Community SQL analytics", chains: ["Multi-chain"] },
    { name: "Token Terminal", url: "https://tokenterminal.com", category: "Analytics", icon: "📈", description: "Fundamentals for crypto protocols", chains: ["Multi-chain"] },
    { name: "L2BEAT", url: "https://l2beat.com", category: "Analytics", icon: "🔍", description: "L2 scaling risk analysis", chains: ["Multi-chain"] },
    { name: "growthepie", url: "https://growthepie.xyz", category: "Analytics", icon: "🥧", description: "Ethereum ecosystem analytics", chains: ["Multi-chain"] },
    { name: "Artemis", url: "https://app.artemis.xyz", category: "Analytics", icon: "🏹", description: "Cross-chain fundamentals data", chains: ["Multi-chain"] },
    { name: "Nansen", url: "https://www.nansen.ai", category: "Analytics", icon: "🔬", description: "On-chain wallet labelling", chains: ["Multi-chain"] },
    { name: "Arkham", url: "https://arkm.com", category: "Analytics", icon: "🕵️", description: "Entity intelligence and tracking", chains: ["Multi-chain"] },
    { name: "Zerion", url: "https://app.zerion.io", category: "Analytics", icon: "🧭", description: "Portfolio tracker and wallet", chains: ["Multi-chain"] },

    // ---------------------------------------------------------------------
    // Developer tools
    // ---------------------------------------------------------------------
    { name: "Tenderly", url: "https://dashboard.tenderly.co", category: "Dev Tools", icon: "🔮", description: "Simulation, debugging and Virtual Environments", chains: ["Multi-chain"] },
    { name: "Foundry", url: "https://www.getfoundry.sh", category: "Dev Tools", icon: "🔨", description: "Fast Solidity testing framework", chains: ["Multi-chain"] },
    { name: "Hardhat", url: "https://hardhat.org", category: "Dev Tools", icon: "⛑️", description: "Ethereum development environment", chains: ["Multi-chain"] },
    { name: "Remix", url: "https://remix.ethereum.org", category: "Dev Tools", icon: "✏️", description: "Browser Solidity IDE", chains: ["Multi-chain"] },
    { name: "OpenZeppelin", url: "https://www.openzeppelin.com", category: "Dev Tools", icon: "🛡️", description: "Audited contract libraries and upgrades", chains: ["Multi-chain"] },
    { name: "Safe", url: "https://app.safe.global", category: "Dev Tools", icon: "🔐", description: "Multisig smart account platform", chains: ["Multi-chain"] },
    { name: "Sourcify", url: "https://sourcify.dev", category: "Dev Tools", icon: "✅", description: "Decentralized contract verification", chains: ["Multi-chain"] },
    { name: "OpenChain", url: "https://openchain.xyz", category: "Dev Tools", icon: "🔗", description: "Signature and selector database (now Sourcify 4byte)", chains: ["Multi-chain"] },
    { name: "4byte Directory", url: "https://www.4byte.directory", category: "Dev Tools", icon: "🔢", description: "Function selector registry", chains: ["Multi-chain"] },
    { name: "Blockscout", url: "https://www.blockscout.com", category: "Dev Tools", icon: "🧱", description: "Open-source block explorer", chains: ["Multi-chain"] },
    { name: "Routescan", url: "https://routescan.io", category: "Dev Tools", icon: "🛣️", description: "Multi-chain explorer and API", chains: ["Multi-chain"] },
    { name: "viem", url: "https://viem.sh", category: "Dev Tools", icon: "🧩", description: "TypeScript Ethereum interface", chains: ["Multi-chain"] },
    { name: "wagmi", url: "https://wagmi.sh", category: "Dev Tools", icon: "⚛️", description: "React hooks for Ethereum", chains: ["Multi-chain"] },
    { name: "ethers.js", url: "https://docs.ethers.org", category: "Dev Tools", icon: "📘", description: "Ethereum JavaScript library", chains: ["Multi-chain"] },
    { name: "Alchemy", url: "https://www.alchemy.com", category: "Dev Tools", icon: "🧪", description: "Node infrastructure and APIs", chains: ["Multi-chain"] },
    { name: "QuickNode", url: "https://www.quicknode.com", category: "Dev Tools", icon: "⚡", description: "Blockchain infrastructure provider", chains: ["Multi-chain"] },

    // ---------------------------------------------------------------------
    // Security
    // ---------------------------------------------------------------------
    { name: "GoPlus", url: "https://gopluslabs.io", category: "Security", icon: "🛡️", description: "Token and contract risk detection", chains: ["Multi-chain"] },
    { name: "De.Fi Scanner", url: "https://de.fi/scanner", category: "Security", icon: "🔎", description: "Contract and wallet risk scanner", chains: ["Multi-chain"] },
    { name: "Honeypot.is", url: "https://honeypot.is", category: "Security", icon: "🍯", description: "Honeypot and tax simulation", chains: ["Ethereum", "BSC", "Base"] },
    { name: "MetaSleuth", url: "https://metasleuth.io", category: "Security", icon: "🕵️", description: "Fund-flow visual investigation", chains: ["Multi-chain"] },
    { name: "BlockSec Phalcon", url: "https://phalcon.blocksec.com", category: "Security", icon: "🦅", description: "Transaction explorer and attack detection", chains: ["Multi-chain"] },
    { name: "Solodit", url: "https://solodit.cyfrin.io", category: "Security", icon: "📚", description: "Aggregated audit findings database", chains: ["Multi-chain"] },
    { name: "Cyfrin", url: "https://www.cyfrin.io", category: "Security", icon: "🔐", description: "Smart contract audits and education", chains: ["Multi-chain"] },
    { name: "Slither", url: "https://github.com/crytic/slither", category: "Security", icon: "🐍", description: "Static analysis for Solidity", chains: ["Multi-chain"] },
    { name: "Echidna", url: "https://github.com/crytic/echidna", category: "Security", icon: "🦔", description: "Property-based fuzzer for EVM", chains: ["Multi-chain"] },
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
