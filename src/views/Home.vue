<template>
    <div class="home">
        <PageHeader title="Ethereum Dev Tools" description="A collection of useful tools for Ethereum developers" />

        <div class="tool-grid">
            <router-link v-for="tool in tools" :key="tool.path" :to="tool.path" class="tool-card">
                <div class="tool-card-header">
                    <div class="tool-card-icon">{{ tool.icon }}</div>
                    <div>
                        <h3 class="tool-card-title">{{ tool.title }}</h3>
                        <p class="tool-card-desc">{{ tool.category }}</p>
                    </div>
                </div>
                <p class="tool-description">{{ tool.description }}</p>
            </router-link>
        </div>
    </div>
</template>

<script setup>
import { PageHeader } from "@/components";

const tools = [
    {
        path: "/payload",
        icon: "📦",
        title: "Payload Parser",
        category: "Decoder",
        description: "Decode transaction calldata with signature lookup and Multicall/Safe support",
    },
    {
        path: "/signature",
        icon: "✍️",
        title: "Signature Extractor",
        category: "Decoder",
        description: "Extract function signatures from Solidity source code or verified contracts",
    },
    {
        path: "/checksum",
        icon: "✓",
        title: "Address Checksum",
        category: "Address Tools",
        description: "Convert Ethereum addresses to checksummed format with validation",
    },
    {
        path: "/vanity",
        icon: "✨",
        title: "Vanity Generator",
        category: "Address Tools",
        description: "Generate vanity addresses with custom prefixes using Web Workers",
    },
    {
        path: "/explorers",
        icon: "🔍",
        title: "Block Explorers",
        category: "Explorer",
        description: "Quick links to block explorers across multiple EVM chains",
    },
    {
        path: "/protocols",
        icon: "🔗",
        title: "Protocol Links",
        category: "Explorer",
        description: "Directory of DeFi protocols organized by category",
    },
    {
        path: "/contract-reader",
        icon: "📖",
        title: "Contract Reader",
        category: "Contracts",
        description: "Read contract state from any RPC with optional production comparison",
    },
    {
        path: "/cache",
        icon: "📋",
        title: "Cache Manager",
        category: "Settings",
        description: "Manage cached address names, symbols, and custom labels",
    },
];
</script>

<style scoped>
.home {
    max-width: 900px;
}

.tool-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-6);
}

.tool-card {
    display: block;
    text-decoration: none;
    color: inherit;
}

.tool-description {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    margin: 0;
    line-height: var(--line-relaxed);
}
</style>
