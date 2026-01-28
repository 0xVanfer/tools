<template>
    <div class="payload-parser">
        <div class="page-header-compact">
            <h1>📦 Payload Parser</h1>
            <span class="text-muted text-sm">Decode transaction calldata</span>
        </div>

        <div class="parser-container">
            <!-- Input Section -->
            <div class="card">
                <div class="card-body">
                    <!-- Supported Formats Info -->
                    <details class="formats-info mb-4">
                        <summary class="text-sm text-muted cursor-pointer">📋 Supported input formats</summary>
                        <div class="formats-list mt-2">
                            <div class="format-item"><span class="badge">Raw</span> 0x... (hex payload)</div>
                            <div class="format-item"><span class="badge">Etherscan</span> https://etherscan.io/tx/0x...</div>
                            <div class="format-item">
                                <span class="badge">Tenderly VNet</span>
                                https://dashboard.tenderly.co/explorer/vnet/{id}/tx/0x...
                            </div>
                            <div class="format-item">
                                <span class="badge">Tenderly VNet List</span>
                                https://dashboard.tenderly.co/explorer/vnet/{id}/transactions
                            </div>
                            <div class="format-item">
                                <span class="badge">Tenderly Simulation</span>
                                https://dashboard.tenderly.co/public/{account}/{project}/simulator/{id}
                            </div>
                            <div class="format-item">
                                <span class="badge">Safe</span>
                                https://app.safe.global/transactions/...
                            </div>
                        </div>
                    </details>

                    <div class="input-row">
                        <label class="label">Payload or Transaction URL</label>
                        <textarea
                            v-model="inputValue"
                            class="input textarea"
                            placeholder="0x... or https://etherscan.io/tx/..."
                            rows="3"
                            @input="onInputChange"
                            @paste="onPaste"
                        ></textarea>
                        <div v-if="inputType" class="input-type-badge mt-2">
                            <span class="badge" :class="inputTypeBadgeClass">{{ inputType }}</span>
                            <span v-if="txInfo" class="text-sm text-muted">{{ txInfo }}</span>
                        </div>
                    </div>

                    <!-- Chain Select (for raw payloads) -->
                    <div v-if="showChainSelect" class="input-row">
                        <ChainSelect v-model="selectedChain" label="Chain (for ABI lookup)" />
                    </div>

                    <div class="actions">
                        <button v-if="vnetRpcUrl" class="btn btn-outline" @click="openContractReader">📖 Read Contract State</button>
                        <LoadingSpinner v-if="loading" size="sm" />
                    </div>
                </div>
            </div>

            <!-- Parse Error -->
            <div v-if="parseError" class="alert alert-error mt-4">
                <span>⚠️</span>
                <span>{{ parseError }}</span>
            </div>

            <!-- Multiple Transactions Selector -->
            <div v-if="multiplePayloads.length > 0" class="card mt-4">
                <div class="card-header">
                    <h3 class="card-title">{{ multiplePayloadsLabel }} ({{ multiplePayloads.length }})</h3>
                </div>
                <div class="card-body">
                    <div class="tx-selector">
                        <button
                            v-for="(tx, idx) in multiplePayloads"
                            :key="idx"
                            class="tx-btn"
                            :class="{ active: selectedTxIndex === idx }"
                            @click="selectTransaction(idx)"
                        >
                            <span class="tx-index">#{{ idx + 1 }}</span>
                            <span class="tx-hash" v-if="tx.txHash">{{ formatHash(tx.txHash) }}</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Error Display -->
            <div v-if="error" class="alert alert-error mt-4">
                <span>⚠️</span>
                <span>{{ error }}</span>
            </div>

            <!-- Transaction Info (from URL) -->
            <div v-if="parsedTxInfo && (parsedTxInfo.from || parsedTxInfo.to)" class="result-container mt-4">
                <div class="result-header">
                    <span class="result-title">Transaction Info</span>
                </div>
                <div class="result-body tx-info">
                    <div v-if="parsedTxInfo.from" class="tx-info-row">
                        <span class="tx-label">From:</span>
                        <a :href="getExplorerAddressUrl(parsedTxInfo.from)" target="_blank" rel="noopener">{{ parsedTxInfo.from }}</a>
                        <span v-if="getAddressLabel(parsedTxInfo.from)" class="addr-name">{{ getAddressLabel(parsedTxInfo.from) }}</span>
                    </div>
                    <div v-if="parsedTxInfo.to" class="tx-info-row">
                        <span class="tx-label">To:</span>
                        <a :href="getExplorerAddressUrl(parsedTxInfo.to)" target="_blank" rel="noopener">{{ parsedTxInfo.to }}</a>
                        <span v-if="getAddressLabel(parsedTxInfo.to)" class="addr-name">{{ getAddressLabel(parsedTxInfo.to) }}</span>
                    </div>
                    <div v-if="parsedTxInfo.value && parsedTxInfo.value !== '0x0'" class="tx-info-row">
                        <span class="tx-label">Value:</span>
                        <code>{{ formatEthValue(parsedTxInfo.value) }}</code>
                    </div>
                </div>
            </div>

            <!-- Results Section -->
            <div v-if="decoded" class="results mt-6">
                <h3 class="results-title">Decoded Result</h3>

                <!-- Safe Transaction Info -->
                <div v-if="decoded.type === 'safe'" class="result-container mt-4">
                    <div class="result-header">
                        <span class="result-title">🔐 Safe Transaction</span>
                        <span class="badge badge-warning">{{ decoded.safeType }}</span>
                    </div>
                    <div class="result-body tx-info" v-if="decoded.execTransaction">
                        <div class="tx-info-row">
                            <span class="tx-label">To:</span>
                            <a :href="getExplorerAddressUrl(decoded.execTransaction.to)" target="_blank" rel="noopener">{{ decoded.execTransaction.to }}</a>
                            <span v-if="getAddressLabel(decoded.execTransaction.to)" class="addr-name">{{ getAddressLabel(decoded.execTransaction.to) }}</span>
                        </div>
                        <div class="tx-info-row">
                            <span class="tx-label">Value:</span>
                            <code>{{ decoded.execTransaction.value }}</code>
                        </div>
                        <div class="tx-info-row">
                            <span class="tx-label">Operation:</span>
                            <span class="badge">{{ decoded.execTransaction.operation === 0 ? "Call" : "DelegateCall" }}</span>
                        </div>
                    </div>
                </div>

                <!-- Multicall Info -->
                <div v-if="decoded.type === 'multicall'" class="result-container mt-4">
                    <div class="result-header">
                        <span class="result-title">📦 Multicall</span>
                        <span class="badge badge-info">{{ decoded.multicallType }}</span>
                    </div>
                    <div class="result-body">
                        <div class="signature-info">
                            <span class="badge badge-primary">{{ decoded.selector }}</span>
                            <span class="mono">{{ decoded.signature }}</span>
                        </div>
                        <div v-if="decoded.deadline" class="mt-2">
                            <span class="text-muted">Deadline:</span>
                            <code>{{ decoded.deadline }}</code>
                        </div>
                    </div>
                </div>

                <!-- Standard Function Signature -->
                <div v-if="!decoded.type || decoded.type === 'standard'" class="result-container mt-4">
                    <div class="result-header">
                        <span class="result-title">Function Signature</span>
                        <CopyButton v-if="decoded.signature" :text="decoded.signature" />
                    </div>
                    <div class="result-body">
                        <div class="signature-info">
                            <span class="badge badge-primary">{{ decoded.selector }}</span>
                            <span class="mono" v-if="decoded.signature">{{ decoded.signature }}</span>
                            <span class="text-muted" v-else>Unknown selector</span>
                        </div>
                        <div v-if="decoded.alternativeSignatures && decoded.alternativeSignatures.length" class="alt-signatures mt-2">
                            <span class="text-sm text-muted">Other possible signatures:</span>
                            <div class="alt-list">
                                <button v-for="sig in decoded.alternativeSignatures" :key="sig" class="alt-sig-btn" @click="useAlternativeSignature(sig)">
                                    {{ sig }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Parameters (for standard decode) -->
                <div v-if="decoded.params && decoded.params.length" class="result-container mt-4">
                    <div class="result-header">
                        <span class="result-title">Parameters</span>
                    </div>
                    <div class="result-body">
                        <ParameterList :key="'params-' + cacheRefreshKey" :params="decoded.params" :chain-id="currentChainId" :depth="0" />
                    </div>
                </div>

                <!-- Nested Calls (Safe/Multicall) -->
                <div v-if="hasNestedCalls" class="result-container mt-4">
                    <div class="result-header">
                        <span class="result-title">
                            {{ decoded.type === "safe" ? "Transactions" : "Calls" }}
                            ({{ nestedCallsCount }})
                        </span>
                    </div>
                    <div class="result-body nested-calls-container">
                        <template v-if="decoded.type === 'safe'">
                            <SafeTransactionCard
                                v-for="(tx, idx) in decoded.transactions"
                                :key="'safe-' + idx + '-' + cacheRefreshKey"
                                :transaction="tx"
                                :index="idx"
                                :chain-id="currentChainId"
                            />
                        </template>
                        <template v-else-if="decoded.type === 'multicall'">
                            <MulticallCard
                                v-for="(call, idx) in decoded.calls"
                                :key="'mc-' + idx + '-' + cacheRefreshKey"
                                :call="call"
                                :index="idx"
                                :chain-id="currentChainId"
                            />
                        </template>
                    </div>
                </div>

                <!-- Collected Addresses -->
                <div v-if="collectedAddresses.length > 0" class="result-container mt-4">
                    <div class="result-header">
                        <span class="result-title">📍 Addresses ({{ collectedAddresses.length }})</span>
                        <CopyButton :text="collectedAddresses.join('\n')" label="Copy All" />
                    </div>
                    <div class="result-body address-grid">
                        <div v-for="addr in collectedAddresses" :key="addr" class="addr-row">
                            <a :href="getExplorerAddressUrl(addr)" target="_blank" rel="noopener">{{ addr }}</a>
                            <span v-if="getAddressLabel(addr)" class="addr-name">{{ getAddressLabel(addr) }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Empty State -->
            <EmptyState
                v-if="!decoded && !loading && !error && !parseError"
                icon="📦"
                title="Enter payload or URL to decode"
                description="Paste transaction calldata, Etherscan TX link, or Tenderly VNet URL"
                class="mt-6"
            />
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { ChainSelect, CopyButton, LoadingSpinner, EmptyState } from "@/components";
import { useChain, useLoading, useAddressDisplay } from "@/composables";
import { isValidAddress } from "@/utils/ethereum";
import { getRpcUrl } from "@/utils/chains";
import { decodePayload, collectAddresses } from "@/utils/decoder";
import { parseInput, detectLinkType } from "@/utils/linkParsers";
import { getAddressDisplayName, getCacheStats } from "@/utils/cacheManager";
import { clearAddresses as clearAddressCollector, collectFromDecoded } from "@/utils/addressCollector";
import { fetchContractInfoFromRpc } from "@/utils/contractInfo";
import { fetchContractNames } from "@/utils/contractName";

// Sub-components for nested display
import ParameterList from "./payload/ParameterList.vue";
import SafeTransactionCard from "./payload/SafeTransactionCard.vue";
import MulticallCard from "./payload/MulticallCard.vue";

const { chainId: selectedChain } = useChain();
const { loading, error, withLoading } = useLoading();

// Input state
const inputValue = ref("");
const inputType = ref(null);
const parseError = ref(null);

// Parsed data from URL
const parsedTxInfo = ref(null);
const vnetRpcUrl = ref(null);
const vnetId = ref(null);
const currentChainId = ref("1");

// Use shared address display utilities - THE SINGLE SOURCE OF TRUTH
// This ensures consistent rendering across all components
const { getName: getAddressLabel, getExplorerUrl: getExplorerAddressUrl, checksum: checksumAddr } = useAddressDisplay(currentChainId);

// Multiple transactions (from VNet list)
const multiplePayloads = ref([]);
const multiplePayloadsLabel = ref("");
const selectedTxIndex = ref(0);

// Decode result
const decoded = ref(null);

// Current payload being decoded
const currentPayload = ref("");

// Debounce timer for auto-parse
let debounceTimer = null;

// Computed
const showChainSelect = computed(() => {
    return !inputType.value || inputType.value === "raw";
});

const inputTypeBadgeClass = computed(() => {
    switch (inputType.value) {
        case "tenderly":
            return "badge-info";
        case "etherscan":
            return "badge-success";
        case "safe":
            return "badge-warning";
        case "raw":
            return "badge-primary";
        default:
            return "";
    }
});

const txInfo = computed(() => {
    if (parsedTxInfo.value?.txHash) {
        return formatHash(parsedTxInfo.value.txHash);
    }
    return null;
});

const hasNestedCalls = computed(() => {
    if (!decoded.value) return false;
    if (decoded.value.type === "safe" && decoded.value.transactions?.length > 0) return true;
    if (decoded.value.type === "multicall" && decoded.value.calls?.length > 0) return true;
    return false;
});

const nestedCallsCount = computed(() => {
    if (!decoded.value) return 0;
    if (decoded.value.type === "safe") return decoded.value.transactions?.length || 0;
    if (decoded.value.type === "multicall") return decoded.value.calls?.length || 0;
    return 0;
});

const collectedAddresses = computed(() => {
    if (!decoded.value) return [];
    const addrs = collectAddresses(decoded.value);

    // Also include from/to addresses from parsed transaction info
    if (parsedTxInfo.value?.from && isValidAddress(parsedTxInfo.value.from)) {
        addrs.add(parsedTxInfo.value.from.toLowerCase());
    }
    if (parsedTxInfo.value?.to && isValidAddress(parsedTxInfo.value.to)) {
        addrs.add(parsedTxInfo.value.to.toLowerCase());
    }

    return Array.from(addrs).map((a) => checksumAddr(a));
});

// Cache refresh key to trigger re-render when cache is updated
const cacheRefreshKey = ref(0);

// Fetch contract info for collected addresses using new modules
// Always uses production RPC (not VNet RPC) for fetching symbols and contract names
const fetchContractInfoForAddresses = async () => {
    const addresses = collectedAddresses.value;
    console.log("[PayloadParser] fetchContractInfoForAddresses called", {
        addressCount: addresses.length,
        addresses: addresses.slice(0, 5),
    });
    if (!addresses.length) return;

    // Determine the chain ID to use for fetching contract info
    // Always use production chain RPC, fall back to Ethereum mainnet if current chain has no RPC
    let fetchChainId = currentChainId.value;
    let rpcUrl = getRpcUrl(fetchChainId);

    // If no RPC URL for current chain, fall back to Ethereum mainnet
    if (!rpcUrl) {
        console.log("[PayloadParser] No RPC for chain", fetchChainId, ", falling back to Ethereum mainnet");
        fetchChainId = "1";
        rpcUrl = getRpcUrl(fetchChainId);
    }

    // Check which addresses need to be fetched (not in cache)
    const addressesToFetch = addresses.filter((addr) => {
        const displayName = getAddressDisplayName(addr, currentChainId.value) || getAddressDisplayName(addr, fetchChainId);
        if (displayName) {
            console.log("[PayloadParser] Found in cache:", addr, displayName);
            return false;
        }
        return true;
    });

    console.log("[PayloadParser] Addresses to fetch from RPC:", addressesToFetch.length);

    // Fetch remaining from production RPC
    // fetchContractInfoFromRpc saves symbols to cache automatically
    if (addressesToFetch.length > 0 && rpcUrl) {
        console.log("[PayloadParser] Using production RPC for chain", fetchChainId, ":", rpcUrl);
        try {
            const fetched = await fetchContractInfoFromRpc(addressesToFetch, rpcUrl, fetchChainId);

            // Force refresh of all components to show newly cached data
            cacheRefreshKey.value++;

            // Fetch contract names from Etherscan for addresses without symbols
            const addressesWithoutSymbol = addressesToFetch.filter((addr) => {
                const info = fetched.get(addr.toLowerCase());
                return !info?.symbol;
            });

            if (addressesWithoutSymbol.length > 0) {
                // Fetch contract names and save to cache (fetchContractNames saves automatically)
                // Don't await - let it run in background
                fetchContractNames(addressesWithoutSymbol, fetchChainId)
                    .then(() => {
                        // Trigger reactivity to show newly cached names
                        cacheRefreshKey.value++;
                    })
                    .catch(() => {});
            }
        } catch (e) {
            console.warn("Failed to fetch contract info:", e);
        }
    }
};

// Watch decoded value and fetch contract info
watch(decoded, (newDecoded) => {
    if (newDecoded) {
        // Clear address collector and collect from new decoded result
        clearAddressCollector();
        collectFromDecoded(newDecoded);
        fetchContractInfoForAddresses();
    }
});

// Watch chain selection and sync to currentChainId
watch(selectedChain, (newChain) => {
    if (newChain && String(newChain) !== currentChainId.value) {
        console.log("[PayloadParser] Chain selection changed:", currentChainId.value, "->", newChain);
        currentChainId.value = String(newChain);

        // Re-fetch contract info with new chain (cache will handle deduplication)
        if (decoded.value) {
            fetchContractInfoForAddresses();
        }
    }
});

// On mount
onMounted(() => {
    // Sync chain selection on mount
    if (selectedChain.value) {
        currentChainId.value = String(selectedChain.value);
    }

    // Check cache stats for debugging
    const stats = getCacheStats();
    if (stats.total > 0) {
        console.log("Address cache loaded:", stats);
    }
});

// Methods

// Auto-parse with debounce for manual edits
const onInputChange = () => {
    const type = detectLinkType(inputValue.value);
    inputType.value = type;

    // Reset state when input changes
    parseError.value = null;

    // Clear previous debounce timer
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }

    // Debounce 1 second for manual edits, then auto-parse
    if (inputValue.value.trim()) {
        debounceTimer = setTimeout(() => {
            decode();
        }, 1000);
    } else {
        // Clear results if input is empty
        decoded.value = null;
        parsedTxInfo.value = null;
        multiplePayloads.value = [];
        vnetRpcUrl.value = null;
        vnetId.value = null;
    }
};

// Immediate parse on paste
const onPaste = () => {
    // Clear any pending debounce
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }

    // Wait for the paste to complete, then parse immediately
    setTimeout(() => {
        const type = detectLinkType(inputValue.value);
        inputType.value = type;
        parseError.value = null;

        if (inputValue.value.trim()) {
            decode();
        }
    }, 0);
};

const decode = async () => {
    decoded.value = null;
    parseError.value = null;
    parsedTxInfo.value = null;
    multiplePayloads.value = [];

    await withLoading(async () => {
        // Parse input (URL or raw payload)
        const parseResult = await parseInput(inputValue.value);

        if (!parseResult.success) {
            parseError.value = parseResult.error;

            // Still capture vnet info for the button
            if (parseResult.vnetRpcUrl) {
                vnetRpcUrl.value = parseResult.vnetRpcUrl;
                vnetId.value = parseResult.vnetId;
            }

            throw new Error(parseResult.error);
        }

        // Update chain and vnet info
        if (parseResult.chainId) {
            currentChainId.value = String(parseResult.chainId);
        } else if (parseResult.source === "raw" && selectedChain.value) {
            // For raw payloads, use the user-selected chain
            currentChainId.value = String(selectedChain.value);
        } else {
            // Fallback to Ethereum mainnet for consistency
            currentChainId.value = "1";
        }
        if (parseResult.vnetRpcUrl) {
            vnetRpcUrl.value = parseResult.vnetRpcUrl;
            vnetId.value = parseResult.vnetId;
        }

        // Handle multiple payloads
        if (parseResult.isMultiple) {
            multiplePayloads.value = parseResult.payloads;
            multiplePayloadsLabel.value = parseResult.label || "Transactions";
            selectedTxIndex.value = 0;

            // Decode first transaction
            const firstPayload = parseResult.payloads[0];
            parsedTxInfo.value = {
                from: firstPayload.from,
                to: firstPayload.to,
                txHash: firstPayload.txHash,
            };

            currentPayload.value = firstPayload.payload;
            await decodePayloadData(firstPayload.payload);
            return;
        }

        // Single payload
        parsedTxInfo.value = {
            from: parseResult.from,
            to: parseResult.to,
            value: parseResult.value,
            txHash: parseResult.txHash,
        };

        currentPayload.value = parseResult.payload;
        await decodePayloadData(parseResult.payload);
    });
};

const decodePayloadData = async (payload) => {
    if (!payload || payload === "0x") {
        decoded.value = { error: "Empty payload" };
        return;
    }

    // Decode
    const result = await decodePayload(payload);
    decoded.value = result;
};

const selectTransaction = async (idx) => {
    selectedTxIndex.value = idx;
    const tx = multiplePayloads.value[idx];

    parsedTxInfo.value = {
        from: tx.from,
        to: tx.to,
        txHash: tx.txHash,
    };

    error.value = null;
    decoded.value = null;
    currentPayload.value = tx.payload;

    try {
        await decodePayloadData(tx.payload);
    } catch (e) {
        error.value = e.message;
    }
};

const useAlternativeSignature = async (sig) => {
    const payload = currentPayload.value || inputValue.value.trim();
    const result = await decodePayload(payload, { signature: sig });
    decoded.value = result;
};

const openContractReader = () => {
    if (vnetRpcUrl.value) {
        // Open VNet reader tool with collected addresses
        const addresses = collectedAddresses.value.join(",");
        const url = `#/contract-reader?rpc=${encodeURIComponent(vnetRpcUrl.value)}&addresses=${encodeURIComponent(addresses)}`;
        window.open(url, "_blank");
    }
};

const formatHash = (hash) => {
    if (!hash) return "";
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
};

const formatEthValue = (value) => {
    if (!value) return "0";
    try {
        const bn = BigInt(value);
        // Convert to ETH (rough display)
        const eth = Number(bn) / 1e18;
        if (eth >= 0.001) {
            return `${eth.toFixed(6)} ETH`;
        }
        return bn.toString() + " wei";
    } catch {
        return value;
    }
};

const jsonReplacer = (key, value) => {
    if (typeof value === "bigint") {
        return value.toString();
    }
    return value;
};
</script>

<style scoped>
.payload-parser {
    padding: var(--space-3);
}

.page-header-compact {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
}

.page-header-compact h1 {
    font-size: var(--text-lg);
    margin: 0;
}

.parser-container {
    max-width: 1100px;
}

.formats-info {
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-sm);
    padding: var(--space-2);
    font-size: var(--text-xs);
}

.formats-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: var(--text-xs);
}

.format-item {
    display: flex;
    align-items: center;
    gap: var(--space-1);
}

.input-row {
    margin-bottom: var(--space-3);
}

.input-type-badge {
    display: flex;
    align-items: center;
    gap: var(--space-2);
}

.actions {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-3);
    flex-wrap: wrap;
}

.tx-selector {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
}

.tx-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-1) var(--space-2);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.2s;
    font-size: var(--text-xs);
}

.tx-btn:hover {
    background: var(--color-bg-hover);
}

.tx-btn.active {
    border-color: var(--color-primary);
    background: var(--color-primary-soft);
}

.tx-index {
    font-weight: var(--font-semibold);
    font-size: 11px;
}

.tx-hash {
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--color-text-muted);
}

.results-title {
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
    margin-bottom: var(--space-2);
}

.signature-info {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    font-size: var(--text-sm);
}

.info-grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
}

.info-item {
    display: flex;
    align-items: center;
    gap: var(--space-1);
}

.info-label {
    font-size: 11px;
    color: var(--color-text-muted);
}

.alt-signatures {
    border-top: 1px solid var(--color-border);
    padding-top: var(--space-2);
}

.alt-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-2);
}

.alt-sig-btn {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    padding: var(--space-1) var(--space-2);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.2s;
}

.alt-sig-btn:hover {
    background: var(--color-primary-soft);
    border-color: var(--color-primary);
}

.nested-calls-container {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.address-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
}

.address-item {
    padding: var(--space-1) var(--space-2);
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-sm);
}

.address-grid {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.addr-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
}

.addr-row a {
    font-family: var(--font-mono);
    color: var(--color-text-primary);
    text-decoration: none;
}

.addr-row a:hover {
    text-decoration: underline;
}

.addr-name {
    color: var(--color-primary);
    font-weight: 500;
}

.tx-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.tx-info-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
}

.tx-info-row a {
    font-family: var(--font-mono);
    color: var(--color-text-primary);
    text-decoration: none;
}

.tx-info-row a:hover {
    text-decoration: underline;
}

.tx-label {
    color: var(--color-text-muted);
    min-width: 50px;
}

details summary {
    cursor: pointer;
    user-select: none;
}

.cursor-pointer {
    cursor: pointer;
}
</style>
