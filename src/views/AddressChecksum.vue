<template>
    <div class="address-checksum">
        <PageHeader title="Address Checksum" description="Convert Ethereum addresses to checksummed and lowercase format" />

        <div class="container">
            <!-- Sidebar (Left) -->
            <div class="sidebar">
                <div class="card">
                    <div class="card-body">
                        <label class="label">Input (any text containing addresses)</label>
                        <textarea v-model="inputText" class="input textarea addresses-input" placeholder="Enter Ethereum addresses" rows="6"></textarea>

                        <button class="btn btn-primary btn-block mt-4" @click="convert" :disabled="!inputText.trim() || isConverting">
                            {{ isConverting ? "pending..." : "Convert" }}
                        </button>

                        <div class="info-log mt-6">
                            <p>Your addresses will be recognized automatically.</p>
                            <p>For example, the input can be:</p>
                            <pre>
[
    {
        "symbol": "stETH",
        "address": "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84"
    },
    {
        "symbol": "eETH",
        "address": "0x35fA164735182de50811E8e2E824cFb9B6118ac2"
    },
    {
        "symbol": "WETH",
        "address": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
    }
]</pre
                            >
                        </div>
                    </div>
                </div>
            </div>

            <!-- Main Content (Right) -->
            <div class="main-content">
                <div class="output-wrapper">
                    <div class="output-title">
                        <button class="btn btn-sm btn-secondary" @click="clearResults">Refresh</button>
                    </div>
                    <div class="output">
                        <div v-for="(result, idx) in results" :key="idx" class="result-group">
                            <div class="result">
                                <strong>Checksum Address:</strong>
                                <span class="address">{{ result.checksum }}</span>
                                <CopyButton :text="result.checksum" />
                            </div>
                            <div class="result">
                                <strong>Lowercase Address:</strong>
                                <span class="address lowercase">{{ result.lowercase }}</span>
                                <CopyButton :text="result.lowercase" />
                            </div>
                            <div class="empty-line"></div>
                        </div>

                        <EmptyState v-if="results.length === 0" icon="✓" title="No addresses yet" description="Enter addresses on the left and click Convert" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref } from "vue";
import { PageHeader, CopyButton, EmptyState } from "@/components";

const inputText = ref("");
const results = ref([]);
const isConverting = ref(false);

/**
 * Find all addresses in input and convert to checksum format
 * @param {string} input - Input string to search for addresses
 * @returns {Array<{checksum: string, lowercase: string}>} - Array of address objects
 */
const findAddressesAndChecksum = (input) => {
    const addresses = [];
    let start = 0;

    while ((start = input.indexOf("0x", start)) !== -1) {
        const address = input.substring(start, start + 42);

        if (address.length < 42) {
            start += 2;
            continue;
        }

        // Validate address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
            start += 2;
            continue;
        }

        try {
            // Use ethers from global scope (loaded via CDN)
            const ethers = window.ethers;
            if (!ethers) {
                start += 2;
                continue;
            }
            const checksummed = ethers.utils.getAddress(address);
            addresses.push({
                checksum: checksummed,
                lowercase: checksummed.toLowerCase(),
            });
        } catch (error) {
            start += 2;
            continue;
        }

        start += 2;
    }

    return addresses;
};

const convert = () => {
    isConverting.value = true;

    try {
        const foundAddresses = findAddressesAndChecksum(inputText.value);

        // Append new results (like the original)
        if (foundAddresses.length > 0) {
            results.value = [...results.value, ...foundAddresses];
        }

        // Clear input after conversion (like the original)
        inputText.value = "";
    } finally {
        isConverting.value = false;
    }
};

const clearResults = () => {
    results.value = [];
};
</script>

<style scoped>
.container {
    display: flex;
    gap: var(--space-6);
    height: calc(100vh - 200px);
    min-height: 500px;
}

.sidebar {
    width: 350px;
    flex-shrink: 0;
}

.sidebar .card {
    height: 100%;
}

.addresses-input {
    height: 100px;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
}

.btn-block {
    width: 100%;
}

.info-log {
    margin-top: 20%;
    padding: var(--space-2);
    overflow-y: auto;
    max-height: 35%;
    border-radius: var(--radius-md);
    font-size: var(--text-xs);
    color: var(--color-text-tertiary);
}

.info-log pre {
    background: var(--color-bg-tertiary);
    padding: var(--space-2);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    overflow-x: auto;
    margin-top: var(--space-2);
}

.main-content {
    flex: 1;
    min-width: 0;
}

.output-wrapper {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-lg);
}

.output-title {
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-border-primary);
    display: flex;
    justify-content: flex-end;
}

.output {
    flex: 1;
    padding: var(--space-4);
    overflow-y: auto;
}

.result-group {
    border-bottom: 1px solid var(--color-border-primary);
    padding-bottom: var(--space-3);
    margin-bottom: var(--space-3);
}

.result-group:last-child {
    border-bottom: none;
}

.result {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
}

.result strong {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    min-width: 140px;
}

.address {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    word-break: break-all;
    flex: 1;
    color: var(--color-accent-success);
}

.address.lowercase {
    color: var(--color-text-primary);
}

.empty-line {
    height: var(--space-2);
}
</style>
