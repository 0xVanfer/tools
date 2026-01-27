<template>
    <div class="cache-manager">
        <div class="page-header-compact">
            <h1>📋 Cache Manager</h1>
            <p class="text-muted text-sm">Manage cached data across all tools</p>
        </div>

        <!-- Cache Type Tabs -->
        <div class="cache-tabs">
            <button v-for="(meta, type) in cacheTypeMeta" :key="type" class="cache-tab" :class="{ active: activeType === type }" @click="activeType = type">
                <span class="tab-icon">{{ meta.icon }}</span>
                <span class="tab-label">{{ meta.label }}</span>
                <span class="tab-count">{{ typeStats[type]?.count || 0 }}</span>
            </button>
        </div>

        <!-- Global Actions -->
        <div class="stats-bar">
            <div class="stats">
                <template v-if="activeType === 'contract'">
                    <span class="stat-item"
                        >Total: <strong>{{ contractStats.total }}</strong></span
                    >
                    <span class="stat-item"
                        >Custom Names: <strong>{{ contractStats.withCustomName }}</strong></span
                    >
                    <span class="stat-item"
                        >Symbols: <strong>{{ contractStats.withSymbol }}</strong></span
                    >
                    <span class="stat-item"
                        >Names: <strong>{{ contractStats.withName }}</strong></span
                    >
                </template>
                <template v-else>
                    <span class="stat-item"
                        >Total Items: <strong>{{ typeStats[activeType]?.count || 0 }}</strong></span
                    >
                </template>
            </div>
            <div class="actions">
                <button v-if="activeType === 'contract'" class="btn btn-sm btn-primary" @click="showAddModal = true">➕ Add Address</button>
                <button class="btn btn-sm btn-outline" @click="exportToFile">📥 Export All</button>
                <label class="btn btn-sm btn-outline">
                    📤 Import
                    <input type="file" accept=".json" @change="importFromFile" hidden />
                </label>
                <button class="btn btn-sm btn-danger" @click="confirmClearType">🗑️ Clear {{ cacheTypeMeta[activeType]?.label }}</button>
            </div>
        </div>

        <!-- Contract Cache View -->
        <template v-if="activeType === 'contract'">
            <!-- Filter -->
            <div class="filter-bar">
                <input v-model="filterText" type="text" class="input input-sm" placeholder="Filter by address or name..." />
                <select v-model="filterChain" class="input input-sm select-chain">
                    <option value="">All Chains</option>
                    <option value="0">🌐 Global (All Chains)</option>
                    <option v-for="chain in availableChains.filter((c) => c !== '0')" :key="chain" :value="chain">
                        {{ getChainName(chain) }} ({{ chain }})
                    </option>
                </select>
            </div>

            <!-- Chain Groups -->
            <div class="chain-groups">
                <div v-if="filteredAddresses.length === 0" class="empty-state">
                    <span>No cached addresses found</span>
                </div>

                <template v-for="chainId in sortedChainIds" :key="chainId">
                    <div v-if="getChainContracts(chainId).length > 0" class="chain-group" :class="{ 'chain-group-global': chainId === '0' }">
                        <div class="chain-header" :class="{ 'chain-header-global': chainId === '0' }">
                            <span class="chain-name">
                                {{ chainId === "0" ? "🌐 Global (All Chains)" : `${getChainName(chainId)} (${chainId})` }}
                            </span>
                            <span class="chain-count">{{ getChainContracts(chainId).length }}</span>
                        </div>
                        <div class="chain-contracts">
                            <div
                                v-for="contract in getChainContracts(chainId)"
                                :key="`${chainId}:${contract.address}`"
                                class="address-item"
                                :class="{ 'address-item-global': chainId === '0' }"
                            >
                                <div class="address-row">
                                    <code class="address-code">{{ contract.address }}</code>
                                    <CopyButton :text="contract.address" />
                                    <div class="contract-badges">
                                        <span v-if="contract.data.customName" class="badge badge-custom">Custom</span>
                                        <span v-if="contract.data.symbol" class="badge badge-symbol">Symbol</span>
                                        <span v-if="contract.data.abi" class="badge badge-abi">ABI</span>
                                        <span v-if="contract.data.vnetDefault" class="badge badge-vnet">VNet</span>
                                        <span v-if="contract.data.isProxy" class="badge badge-proxy">Proxy</span>
                                    </div>
                                </div>
                                <div class="info-row">
                                    <div class="info-field" v-if="contract.data.customName">
                                        <span class="field-label">Custom:</span>
                                        <span class="field-value custom">{{ contract.data.customName }}</span>
                                    </div>
                                    <div class="info-field" v-if="contract.data.symbol">
                                        <span class="field-label">Symbol:</span>
                                        <span class="field-value symbol">{{ contract.data.symbol }}</span>
                                    </div>
                                    <div class="info-field" v-if="contract.data.name">
                                        <span class="field-label">Name:</span>
                                        <span class="field-value name">{{ contract.data.name }}</span>
                                    </div>
                                    <div class="info-field updated" v-if="contract.data.updatedAt">
                                        <span class="field-label">Updated:</span>
                                        <span class="field-value">{{ formatDate(contract.data.updatedAt) }}</span>
                                    </div>
                                </div>
                                <div class="action-row">
                                    <label class="vnet-toggle" :title="contract.data.vnetDefault ? 'Remove from VNet defaults' : 'Add to VNet defaults'">
                                        <input
                                            type="checkbox"
                                            :checked="contract.data.vnetDefault"
                                            @change="toggleVnetDefault(contract.address, chainId, $event.target.checked)"
                                        />
                                        <span class="toggle-label">VNet</span>
                                    </label>
                                    <button
                                        class="btn-icon"
                                        @click="editCustomName({ address: contract.address, chainId, info: contract.data })"
                                        title="Edit custom name"
                                    >
                                        ✏️
                                    </button>
                                    <button class="btn-icon" @click="removeAddress({ address: contract.address, chainId })" title="Remove">❌</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </template>
            </div>
        </template>

        <!-- Generic Cache View (for other types) -->
        <template v-else>
            <div class="generic-cache-list">
                <div v-if="currentTypeEntries.length === 0" class="empty-state">
                    <span>No cached {{ cacheTypeMeta[activeType]?.label.toLowerCase() }} found</span>
                </div>
                <div v-for="(entry, idx) in currentTypeEntries" :key="idx" class="cache-entry-item">
                    <div class="entry-key">
                        <code>{{ formatEntryKey(entry) }}</code>
                    </div>
                    <div class="entry-data">
                        <pre class="data-preview">{{ formatEntryData(entry.data) }}</pre>
                    </div>
                    <div class="entry-meta" v-if="entry.data?.updatedAt">
                        <span class="text-muted text-xs">{{ formatDate(entry.data.updatedAt) }}</span>
                    </div>
                </div>
            </div>
        </template>

        <!-- Edit Modal -->
        <div v-if="editItem" class="modal-overlay" @click.self="editItem = null">
            <div class="modal">
                <div class="modal-header">
                    <h3>Edit Custom Name</h3>
                    <button class="btn-close" @click="editItem = null">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="label">Address</label>
                        <code class="address-code">{{ editItem.address }}</code>
                    </div>
                    <div class="form-group">
                        <label class="label">Chain</label>
                        <select v-model="editChainId" class="input input-sm">
                            <option value="0">Global (all chains)</option>
                            <option v-for="(chain, chainId) in chains" :key="chainId" :value="String(chainId)">{{ chain.name }} ({{ chainId }})</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="label">Custom Name</label>
                        <input v-model="editName" type="text" class="input" placeholder="Enter custom name..." />
                    </div>
                    <div class="form-group">
                        <label class="toggle-row">
                            <input type="checkbox" v-model="editVnetDefault" />
                            <span>Show in VNet dropdown by default</span>
                        </label>
                        <small class="text-muted">Addresses marked as VNet default will appear in the VNet Reader address selector</small>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" @click="editItem = null">Cancel</button>
                    <button class="btn btn-primary" @click="saveCustomName">Save</button>
                </div>
            </div>
        </div>

        <!-- Add Address Modal -->
        <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
            <div class="modal">
                <div class="modal-header">
                    <h3>➕ Add Contract Address</h3>
                    <button class="btn-close" @click="showAddModal = false">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="label">Chain</label>
                        <select v-model="addChainId" class="input input-sm">
                            <option value="0">🌐 0 - Global (All Chains)</option>
                            <option v-for="(chain, chainId) in chains" :key="chainId" :value="String(chainId)">{{ chainId }} - {{ chain.name }}</option>
                        </select>
                        <small class="text-muted">Select "Global" to apply name to all chains</small>
                    </div>
                    <div class="form-group">
                        <label class="label">Contract Address</label>
                        <input v-model="addAddress" type="text" class="input" placeholder="0x..." />
                    </div>
                    <div class="form-group">
                        <label class="label">Custom Name (optional)</label>
                        <input v-model="addCustomName" type="text" class="input" placeholder="Enter custom name..." />
                        <small class="text-muted">Custom name overrides symbol and contract name</small>
                    </div>
                    <div class="form-group">
                        <label class="toggle-row">
                            <input type="checkbox" v-model="addVnetDefault" />
                            <span>Show in VNet dropdown by default</span>
                        </label>
                    </div>
                    <div v-if="addStatus" class="add-status" :class="addStatusType">{{ addStatus }}</div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" @click="showAddModal = false">Cancel</button>
                    <button class="btn btn-primary" @click="handleAddAddress" :disabled="isAddingAddress">
                        {{ isAddingAddress ? "Adding..." : "💾 Save" }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { CopyButton } from "@/components";
import {
    getAllCachedAddresses,
    getCacheStats,
    setCustomName,
    removeCachedAddress,
    clearCache,
    exportCache,
    importCache,
    CacheTypes,
    CacheTypeMeta,
    getAllCacheEntries,
    getCacheStatsByType,
    exportAllCache,
    importAllCache,
    createStore,
    getContractCacheByChain,
    GLOBAL_CHAIN_ID,
    setContractCache,
    setVnetDefault,
} from "@/utils/cacheManager";
import { getChainName, chains } from "@/utils/chains";
import { isValidAddress, toChecksumAddress } from "@/utils/ethereum";

// Active cache type
const activeType = ref(CacheTypes.CONTRACT);
const cacheTypeMeta = CacheTypeMeta;

// All cache entries
const allEntries = ref([]);
const typeStats = ref({});

// Contract-specific state
const addresses = ref([]);
const contractsByChain = ref({});
const contractStats = ref({ total: 0, withCustomName: 0, withSymbol: 0, withName: 0, withVnetDefault: 0, byChain: {} });
const filterText = ref("");
const filterChain = ref("");

// Edit modal
const editItem = ref(null);
const editName = ref("");
const editChainId = ref("0");
const editVnetDefault = ref(false);

// Add address modal
const showAddModal = ref(false);
const addChainId = ref("1");
const addAddress = ref("");
const addCustomName = ref("");
const addVnetDefault = ref(false);
const addStatus = ref("");
const addStatusType = ref("");
const isAddingAddress = ref(false);

const loadData = () => {
    // Load contract addresses
    addresses.value = getAllCachedAddresses();
    contractsByChain.value = getContractCacheByChain();
    contractStats.value = getCacheStats();

    // Load all entries for stats
    allEntries.value = getAllCacheEntries();
    typeStats.value = getCacheStatsByType();
};

onMounted(loadData);

// Current type entries (for non-contract views)
const currentTypeEntries = computed(() => {
    return allEntries.value.filter((e) => e.type === activeType.value);
});

// Get sorted chain IDs with global first
const sortedChainIds = computed(() => {
    const chainIds = Object.keys(contractsByChain.value);
    return chainIds.sort((a, b) => {
        // Global chain (0) should come first
        if (a === GLOBAL_CHAIN_ID) return -1;
        if (b === GLOBAL_CHAIN_ID) return 1;
        // Then sort numerically
        return Number(a) - Number(b);
    });
});

const availableChains = computed(() => {
    const chains = new Set();
    addresses.value.forEach((item) => chains.add(item.chainId));
    return Array.from(chains).sort((a, b) => {
        if (a === "0") return -1;
        if (b === "0") return 1;
        return Number(a) - Number(b);
    });
});

// Get contracts for a specific chain, with filtering applied
const getChainContracts = (chainId) => {
    if (filterChain.value && filterChain.value !== chainId) {
        return [];
    }

    let contracts = contractsByChain.value[chainId] || [];

    if (filterText.value) {
        const search = filterText.value.toLowerCase();
        contracts = contracts.filter((c) => {
            return (
                c.address.toLowerCase().includes(search) ||
                c.data.customName?.toLowerCase().includes(search) ||
                c.data.symbol?.toLowerCase().includes(search) ||
                c.data.name?.toLowerCase().includes(search)
            );
        });
    }

    return contracts;
};

const filteredAddresses = computed(() => {
    let result = addresses.value;

    if (filterChain.value) {
        result = result.filter((item) => item.chainId === filterChain.value);
    }

    if (filterText.value) {
        const search = filterText.value.toLowerCase();
        result = result.filter((item) => {
            return (
                item.address.toLowerCase().includes(search) ||
                item.info.customName?.toLowerCase().includes(search) ||
                item.info.symbol?.toLowerCase().includes(search) ||
                item.info.name?.toLowerCase().includes(search)
            );
        });
    }

    return result.sort((a, b) => (b.info.updatedAt || 0) - (a.info.updatedAt || 0));
});

const formatDate = (timestamp) => {
    if (!timestamp) return "";
    return new Date(timestamp).toLocaleString();
};

const formatEntryKey = (entry) => {
    if (entry.address) return entry.address;
    if (entry.selector) return entry.selector;
    if (entry.setting) return entry.setting;
    if (entry.id) return entry.id;
    return entry.fullKey?.split(":").slice(2).join(":") || "Unknown";
};

const formatEntryData = (data) => {
    if (!data) return "";
    const { updatedAt, ...rest } = data;
    return JSON.stringify(rest, null, 2);
};

const editCustomName = (item) => {
    editItem.value = item;
    editName.value = item.info.customName || "";
    editChainId.value = item.chainId;
    editVnetDefault.value = item.info.vnetDefault || false;
};

const saveCustomName = () => {
    if (editItem.value) {
        const data = {
            customName: editName.value.trim() || null,
            vnetDefault: editVnetDefault.value,
        };
        setContractCache(editItem.value.address, data, editChainId.value);
        loadData();
    }
    editItem.value = null;
};

const toggleVnetDefault = (address, chainId, checked) => {
    setVnetDefault(address, checked, chainId);
    loadData();
};

const handleAddAddress = () => {
    const address = addAddress.value.trim();
    const chainId = addChainId.value;
    const customName = addCustomName.value.trim() || null;
    const vnetDefault = addVnetDefault.value;
    const isGlobal = chainId === GLOBAL_CHAIN_ID;

    // Validate address
    if (!address) {
        addStatus.value = "Please enter an address";
        addStatusType.value = "error";
        return;
    }

    if (!isValidAddress(address)) {
        addStatus.value = "Invalid address format";
        addStatusType.value = "error";
        return;
    }

    // For global chain, require custom name
    if (isGlobal && !customName) {
        addStatus.value = "Custom name is required for global addresses";
        addStatusType.value = "error";
        return;
    }

    try {
        const normalizedAddress = toChecksumAddress(address);
        const data = {
            customName,
            vnetDefault,
        };

        setContractCache(normalizedAddress, data, chainId);

        addStatus.value = `✓ Saved: ${normalizedAddress.slice(0, 10)}...`;
        addStatusType.value = "success";

        loadData();

        // Close modal after short delay
        setTimeout(() => {
            showAddModal.value = false;
            // Reset form
            addAddress.value = "";
            addCustomName.value = "";
            addVnetDefault.value = false;
            addStatus.value = "";
            addStatusType.value = "";
        }, 800);
    } catch (err) {
        addStatus.value = `Error: ${err.message}`;
        addStatusType.value = "error";
    }
};

const removeAddress = (item) => {
    if (confirm(`Remove ${item.address} from cache?`)) {
        removeCachedAddress(item.address, item.chainId);
        loadData();
    }
};

const confirmClearType = () => {
    const typeName = cacheTypeMeta[activeType.value]?.label || activeType.value;
    if (confirm(`Clear ALL cached ${typeName.toLowerCase()}? This cannot be undone.`)) {
        if (activeType.value === CacheTypes.CONTRACT) {
            clearCache();
        } else {
            const store = createStore(activeType.value);
            store.clear();
        }
        loadData();
    }
};

const exportToFile = () => {
    // Export all cache types
    const data = exportAllCache();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eth-tools-cache-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

const importFromFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target?.result;
        if (typeof content === "string") {
            // Try new v2 format first
            const result = importAllCache(content);
            if (result.success) {
                loadData();
                alert("Import completed!");
                return;
            }
            // Fall back to v1 contract format
            if (importCache(content)) {
                loadData();
                alert("Import completed!");
                return;
            }
        }
        alert("Import failed. Check console for details.");
    };
    reader.readAsText(file);
    event.target.value = "";
};
</script>

<style scoped>
.cache-manager {
    padding: var(--space-4);
    max-width: 1200px;
    margin: 0 auto;
}

.page-header-compact {
    margin-bottom: var(--space-4);
}

.page-header-compact h1 {
    font-size: var(--text-lg);
    margin: 0;
}

/* Cache Type Tabs */
.cache-tabs {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
    overflow-x: auto;
    padding-bottom: var(--space-1);
}

.cache-tab {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
}

.cache-tab:hover {
    background: var(--color-bg-hover);
}

.cache-tab.active {
    background: var(--color-accent-primary);
    color: white;
    border-color: var(--color-accent-primary);
}

.tab-icon {
    font-size: var(--text-base);
}

.tab-label {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
}

.tab-count {
    font-size: var(--text-xs);
    background: rgba(0, 0, 0, 0.1);
    padding: 2px 6px;
    border-radius: var(--radius-full);
}

.cache-tab.active .tab-count {
    background: rgba(255, 255, 255, 0.2);
}

.stats-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-3);
    padding: var(--space-3);
    background: var(--color-bg-secondary);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-3);
}

.stats {
    display: flex;
    gap: var(--space-4);
    flex-wrap: wrap;
}

.stat-item {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
}

.stat-item strong {
    color: var(--color-text-primary);
}

.actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
}

.filter-bar {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
}

.filter-bar .input {
    flex: 1;
}

.select-chain {
    max-width: 200px;
}

/* Chain Groups */
.chain-groups {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
}

.chain-group {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
}

.chain-group-global {
    border-color: var(--color-primary);
    background: linear-gradient(135deg, rgba(79, 70, 229, 0.05) 0%, transparent 100%);
}

.chain-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3) var(--space-4);
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border);
    font-weight: var(--font-medium);
}

.chain-header-global {
    background: linear-gradient(90deg, rgba(79, 70, 229, 0.15) 0%, var(--color-bg-secondary) 100%);
    border-bottom-color: var(--color-primary);
}

.chain-name {
    font-size: var(--text-sm);
}

.chain-count {
    font-size: var(--text-xs);
    background: var(--color-bg-tertiary);
    padding: 2px 8px;
    border-radius: var(--radius-full);
    color: var(--color-text-secondary);
}

.chain-header-global .chain-count {
    background: var(--color-primary);
    color: white;
}

.chain-contracts {
    display: flex;
    flex-direction: column;
}

.address-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.empty-state {
    text-align: center;
    padding: var(--space-6);
    color: var(--color-text-muted);
}

.address-item {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--space-2);
    padding: var(--space-3);
    background: var(--color-bg-primary);
    border-bottom: 1px solid var(--color-border);
}

.address-item:last-child {
    border-bottom: none;
}

.address-item-global {
    background: rgba(79, 70, 229, 0.03);
}

.address-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    grid-column: 1 / 2;
    flex-wrap: wrap;
}

.contract-badges {
    display: flex;
    gap: var(--space-1);
    flex-wrap: wrap;
}

.badge {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    font-weight: var(--font-medium);
}

.badge-custom {
    background: var(--color-primary);
    color: white;
}

.badge-symbol {
    background: var(--color-success);
    color: white;
}

.badge-abi {
    background: var(--color-info);
    color: white;
}

.badge-vnet {
    background: var(--color-warning);
    color: var(--color-text-primary);
}

.badge-proxy {
    background: var(--color-secondary);
    color: white;
}

.chain-badge {
    font-size: var(--text-xs);
    background: var(--color-primary);
    color: white;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    min-width: 24px;
    text-align: center;
}

.address-code {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
}

.info-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    grid-column: 1 / 2;
}

.info-field {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-xs);
}

.field-label {
    color: var(--color-text-muted);
}

.field-value {
    font-weight: var(--font-medium);
}

.field-value.custom {
    color: var(--color-primary);
}

.field-value.symbol {
    color: var(--color-success);
}

.field-value.name {
    color: var(--color-info);
}

.info-field.updated {
    color: var(--color-text-muted);
}

.action-row {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    grid-column: 2 / 3;
    grid-row: 1 / 3;
}

.btn-icon {
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--space-1);
    font-size: var(--text-sm);
    opacity: 0.6;
    transition: opacity 0.2s;
}

.btn-icon:hover {
    opacity: 1;
}

/* Modal */
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
}

.modal {
    background: var(--color-bg-primary);
    border-radius: var(--radius-lg);
    width: 90%;
    max-width: 500px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-border);
}

.modal-header h3 {
    margin: 0;
    font-size: var(--text-base);
}

.btn-close {
    background: none;
    border: none;
    font-size: var(--text-xl);
    cursor: pointer;
    color: var(--color-text-muted);
}

.modal-body {
    padding: var(--space-4);
}

.form-group {
    margin-bottom: var(--space-3);
}

.form-group:last-child {
    margin-bottom: 0;
}

.modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-top: 1px solid var(--color-border);
}

.btn-sm {
    font-size: var(--text-xs);
    padding: var(--space-1) var(--space-2);
}

.btn-danger {
    background: var(--color-error);
    color: white;
}

.btn-warning {
    background: var(--color-warning);
    color: black;
}

.input-sm {
    font-size: var(--text-sm);
    padding: var(--space-2);
}

/* Generic Cache List */
.generic-cache-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.cache-entry-item {
    padding: var(--space-3);
    background: var(--color-bg-secondary);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border-primary);
}

.entry-key {
    margin-bottom: var(--space-2);
}

.entry-key code {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-accent-primary);
}

.data-preview {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    background: var(--color-bg-tertiary);
    padding: var(--space-2);
    border-radius: var(--radius-sm);
    overflow-x: auto;
    max-height: 100px;
    margin: 0;
}

.entry-meta {
    margin-top: var(--space-2);
}

/* VNet Toggle */
.vnet-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    cursor: pointer;
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
}

.vnet-toggle input[type="checkbox"] {
    cursor: pointer;
}

.vnet-toggle .toggle-label {
    user-select: none;
}

.toggle-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
}

.toggle-row input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
}

/* Add Status */
.add-status {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    margin-top: var(--space-2);
}

.add-status.success {
    background: var(--color-success-bg, rgba(34, 197, 94, 0.1));
    color: var(--color-success);
}

.add-status.error {
    background: var(--color-danger-bg, rgba(239, 68, 68, 0.1));
    color: var(--color-danger);
}

.add-status.loading {
    background: var(--color-info-bg, rgba(59, 130, 246, 0.1));
    color: var(--color-info);
}
</style>
