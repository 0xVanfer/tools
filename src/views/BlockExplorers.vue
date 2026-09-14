<template>
    <div class="block-explorers">
        <PageHeader title="Block Explorers" description="Quick links to block explorers across EVM chains" />

        <div class="explorers-container">
            <!-- Search Input -->
            <div class="search-section">
                <div class="input-row">
                    <label class="label">Search (Address / Transaction / Block)</label>
                    <input v-model="searchQuery" type="text" class="input mono" placeholder="0x... or block number (optional)" />
                </div>
            </div>

            <!-- Chain Filter -->
            <SearchInput v-model="chainFilter" placeholder="Filter chains..." class="mt-6" />

            <!-- Chains Grid -->
            <div class="chains-grid mt-6">
                <div v-for="chain in filteredChains" :key="chain.chainId" class="chain-card">
                    <div class="chain-header">
                        <div class="chain-info">
                            <span class="chain-name">{{ chain.name }}</span>
                            <span class="chain-id text-muted">Chain ID: {{ chain.chainId }}</span>
                        </div>
                    </div>

                    <div class="chain-links">
                        <a :href="getExplorerLink(chain)" target="_blank" rel="noopener noreferrer" class="explorer-link">
                            <span class="link-icon">🔍</span>
                            <span class="link-text">{{ getExplorerName(chain) }}</span>
                            <span class="link-arrow">→</span>
                        </a>
                    </div>
                </div>
            </div>

            <!-- Empty State -->
            <EmptyState v-if="filteredChains.length === 0" icon="🔍" title="No chains found" description="Try a different search term" class="mt-6" />
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { PageHeader, SearchInput, EmptyState } from "@/components";
import { chains, getExplorerUrl } from "@/utils/chains";

const searchQuery = ref("");
const chainFilter = ref("");

// Convert chains object to sorted array, excluding testnets
const allChains = computed(() => {
    return Object.entries(chains)
        .map(([chainId, config]) => ({
            chainId: Number(chainId),
            ...config,
        }))
        .filter((chain) => !chain.isTestnet)
        .sort((a, b) => {
            // Sort by name, but put Ethereum first
            if (a.chainId === 1) return -1;
            if (b.chainId === 1) return 1;
            return a.name.localeCompare(b.name);
        });
});

const filteredChains = computed(() => {
    if (!chainFilter.value) return allChains.value;

    const filter = chainFilter.value.toLowerCase();
    return allChains.value.filter(
        (chain) =>
            chain.name.toLowerCase().includes(filter) ||
            chain.shortName?.toLowerCase().includes(filter) ||
            chain.internalName?.toLowerCase().includes(filter) ||
            String(chain.chainId).includes(filter),
    );
});

const getExplorerName = (chain) => {
    // Extract explorer name from URL
    try {
        const url = new URL(chain.explorer);
        return url.hostname.replace("www.", "");
    } catch {
        return "Explorer";
    }
};

/**
 * Classify the query so we can build a direct explorer path.
 */
const detectQueryType = (query) => {
    if (/^0x[a-fA-F0-9]{64}$/.test(query)) return "tx";
    if (/^0x[a-fA-F0-9]{40}$/.test(query)) return "address";
    if (/^\d+$/.test(query)) return "block";
    return null;
};

/**
 * Get explorer link - auto-detect type from query or go to home.
 *
 * Uses the per-chain path builder for address/tx/block and only falls back to the
 * generic `/search?q=` endpoint for free-text queries (the previous code always
 * used `/search`, which is wrong for non-Etherscan explorers).
 */
const getExplorerLink = (chain) => {
    const query = searchQuery.value.trim();

    // No query - go to explorer home
    if (!query) {
        return chain.explorer;
    }

    const type = detectQueryType(query);
    if (type) {
        const direct = getExplorerUrl(chain.chainId, query, type);
        if (direct) return direct;
    }

    return `${chain.explorer}/search?q=${encodeURIComponent(query)}`;
};
</script>

<style scoped>
.explorers-container {
    max-width: 1000px;
}

.search-section {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-xl);
    padding: var(--space-6);
}

.input-row {
}

.mono {
    font-family: var(--font-mono);
}

.chains-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-4);
}

.chain-card {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    transition: all var(--transition-fast);
}

.chain-card:hover {
    border-color: var(--color-border-secondary);
    box-shadow: var(--shadow-md);
}

.chain-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
}

.chain-info {
    display: flex;
    flex-direction: column;
}

.chain-name {
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
}

.chain-id {
    font-size: var(--text-xs);
}

.chain-links {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.explorer-link {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-md);
    color: var(--color-text-primary);
    text-decoration: none;
    transition: all var(--transition-fast);
}

.explorer-link:hover {
    background: var(--color-bg-hover);
}

.explorer-link.secondary {
    background: transparent;
    border: 1px solid var(--color-border-primary);
}

.explorer-link.disabled {
    opacity: 0.5;
    pointer-events: none;
}

.link-icon {
    font-size: 14px;
}

.link-text {
    flex: 1;
    font-size: var(--text-sm);
}

.link-arrow {
    color: var(--color-text-tertiary);
}
</style>
