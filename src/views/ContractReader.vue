<template>
    <div class="contract-reader">
        <PageHeader title="Contract Reader" description="Batch read contract state via Multicall3 with optional production comparison" />

        <div class="reader-container">
            <!-- RPC Connection Section -->
            <div class="card" :class="{ 'card-collapsed': isRpcLocked }">
                <!-- Collapsed view when connected -->
                <div v-if="isRpcLocked" class="rpc-collapsed">
                    <div class="rpc-collapsed-info">
                        <span class="status-indicator connected"></span>
                        <span class="chain-name">{{ detectedChainName || getChainName(effectiveChainId) }}</span>
                        <span v-if="customRpcUrl" class="custom-rpc-badge" title="Using custom RPC">🔗 Custom RPC</span>
                        <span v-else class="production-badge">Production</span>
                        <span v-if="customRpcUrl && productionRpcUrl" class="compare-badge">⚖️ Comparing</span>
                    </div>
                    <button class="btn btn-sm btn-outline" @click="resetConnection">Reset</button>
                </div>

                <!-- Full view when not connected -->
                <template v-else>
                    <div class="card-header">
                        <h3 class="card-title">🔌 RPC Connection</h3>
                    </div>
                    <div class="card-body">
                        <!-- Chain Selection Row -->
                        <div class="rpc-row">
                            <div class="rpc-field chain-field">
                                <label class="label">Chain</label>
                                <select v-model="selectedChainId" class="input select" @change="onChainChange">
                                    <option value="">Select chain...</option>
                                    <option v-for="chain in availableChains" :key="chain.id" :value="chain.id">
                                        {{ chain.name }}
                                    </option>
                                </select>
                            </div>
                            <div class="rpc-field rpc-input-field">
                                <label class="label">Custom RPC URL <span class="text-muted">(optional)</span></label>
                                <div class="rpc-input-wrapper">
                                    <input
                                        v-model="customRpcUrl"
                                        type="text"
                                        class="input mono"
                                        placeholder="https://virtual.mainnet.rpc.tenderly.co/..."
                                        @keyup.enter="connectRpc"
                                    />
                                </div>
                            </div>
                        </div>

                        <!-- Connect Button -->
                        <div class="rpc-actions-row">
                            <div class="status-item">
                                <span class="status-indicator" :class="connectionStatusClass"></span>
                                <span>{{ connectionStatusText }}</span>
                            </div>
                            <button class="btn btn-primary" :disabled="connecting || (!customRpcUrl && !selectedChainId)" @click="connectRpc">
                                {{ connecting ? "Connecting..." : "Connect" }}
                            </button>
                        </div>
                        <div v-if="error" class="status-error mt-2">⚠️ {{ error }}</div>
                    </div>
                </template>
            </div>

            <!-- Add Call Section - only show when connected -->
            <div v-if="isRpcLocked" class="card mt-4">
                <div class="card-header">
                    <h3 class="card-title">➕ Add Call</h3>
                </div>
                <div class="card-body">
                    <!-- Contract Address -->
                    <div class="form-group">
                        <label class="label">Contract Address</label>
                        <div class="address-input-row">
                            <select
                                v-if="addressOptions.length > 0"
                                v-model="selectedAddressOption"
                                class="input select address-select"
                                @change="onAddressSelect"
                            >
                                <option value="">-- Quick select --</option>
                                <optgroup v-if="urlAddresses.length > 0" label="From Payload">
                                    <option v-for="addr in urlAddresses" :key="'url-' + addr.address" :value="addr.address">
                                        {{ formatAddressOption(addr) }}
                                    </option>
                                </optgroup>
                                <optgroup v-if="favoriteAddresses.length > 0" label="Favorites">
                                    <option v-for="addr in favoriteAddresses" :key="'fav-' + addr.address" :value="addr.address">
                                        {{ formatAddressOption(addr) }}
                                    </option>
                                </optgroup>
                            </select>
                            <input v-model="targetAddress" type="text" class="input mono" placeholder="0x..." @blur="onAddressBlur" />
                            <span v-if="loadingAbi" class="abi-status loading">⏳</span>
                            <span v-else-if="hasLoadedAbi" class="abi-status loaded" title="ABI loaded">✓</span>
                        </div>
                    </div>

                    <!-- Method Selection -->
                    <div class="form-group method-selection-group">
                        <label class="label">Method</label>
                        <div class="method-input-row">
                            <div class="method-search-wrapper" ref="methodInputWrapper">
                                <input
                                    v-model="methodSearch"
                                    type="text"
                                    class="input mono"
                                    placeholder="Search or type signature: balanceOf(address)"
                                    @focus="openMethodSuggestions"
                                    @blur="hideMethodSuggestionsDelayed"
                                    @input="onMethodSearchInput"
                                    @keydown.enter="selectFirstSuggestion"
                                />
                            </div>
                            <button class="btn btn-secondary add-call-btn" :disabled="!canAddCall" @click="addCallToQueue">+ Add</button>
                        </div>
                        <div v-if="selectedMethod" class="selected-method-info">
                            <code>{{ selectedMethod.signature }}</code>
                            <span v-if="selectedMethod.outputs" class="text-muted"> → {{ selectedMethod.outputs }}</span>
                        </div>
                    </div>

                    <!-- Method Suggestions Dropdown (Portal - rendered outside card) -->
                    <Teleport to="body">
                        <div v-if="showMethodSuggestions && filteredMethods.length > 0" class="method-suggestions-portal" :style="suggestionDropdownStyle">
                            <div
                                v-for="method in filteredMethods"
                                :key="method.signature"
                                class="suggestion-item"
                                :class="{ 'from-abi': method.fromAbi }"
                                @mousedown.prevent="selectMethod(method)"
                            >
                                <span class="suggestion-name">{{ method.name }}</span>
                                <span class="suggestion-sig">{{ method.signature }}</span>
                                <span v-if="method.fromAbi" class="suggestion-badge">ABI</span>
                                <span v-else class="suggestion-badge preset">{{ method.category }}</span>
                            </div>
                        </div>
                    </Teleport>

                    <!-- Parameters -->
                    <div v-if="selectedMethod && selectedMethod.inputTypes.length > 0" class="form-group">
                        <label class="label">Parameters</label>
                        <div class="params-list">
                            <div v-for="(type, index) in selectedMethod.inputTypes" :key="index" class="param-row">
                                <span class="param-type">{{ type }}</span>
                                <span v-if="selectedMethod.inputNames[index]" class="param-name">{{ selectedMethod.inputNames[index] }}</span>
                                <div class="param-input-wrapper">
                                    <input v-model="paramValues[index]" type="text" class="input mono param-input" :placeholder="getParamPlaceholder(type)" />
                                    <!-- Decimals selector for uint types -->
                                    <select v-if="isNumericType(type)" v-model="paramDecimals[index]" class="param-decimals" title="Multiply by 10^n">
                                        <option :value="0">×1</option>
                                        <option :value="6">×10⁶</option>
                                        <option :value="8">×10⁸</option>
                                        <option :value="18">×10¹⁸</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Call Queue Section -->
            <div v-if="callQueue.length > 0" class="card mt-4">
                <div class="card-header">
                    <h3 class="card-title">📋 Call Queue ({{ callQueue.length }})</h3>
                    <button class="btn btn-sm btn-outline" @click="clearQueue">Clear All</button>
                </div>
                <div class="card-body">
                    <div class="call-queue">
                        <div v-for="(call, index) in callQueue" :key="index" class="queue-item">
                            <div class="queue-item-info">
                                <span class="queue-index">{{ index + 1 }}</span>
                                <span class="queue-address" :title="call.target">{{ formatAddress(call.target) }}</span>
                                <span class="queue-method">{{ call.methodName }}</span>
                                <span v-if="call.args.length > 0" class="queue-args">({{ call.args.map(formatArgDisplay).join(", ") }})</span>
                            </div>
                            <button class="btn btn-icon btn-sm" @click="removeFromQueue(index)" title="Remove">✕</button>
                        </div>
                    </div>

                    <!-- Execute Button -->
                    <div class="queue-actions">
                        <button class="btn btn-primary btn-lg" :disabled="executing" @click="executeQueue">
                            {{ executing ? "Executing..." : `Execute ${callQueue.length} Call${callQueue.length > 1 ? "s" : ""}` }}
                        </button>
                    </div>
                </div>
            </div>

            <!-- Results Section -->
            <div v-if="results.length > 0" class="card mt-4">
                <div class="card-header">
                    <h3 class="card-title">📊 Results ({{ results.length }})</h3>
                    <div class="result-header-actions">
                        <div class="result-summary">
                            <span class="summary-success">✓ {{ successCount }}</span>
                            <span v-if="failCount > 0" class="summary-fail">✗ {{ failCount }}</span>
                            <span v-if="compareWithProduction && mismatchCount > 0" class="summary-mismatch">⚠ {{ mismatchCount }} diff</span>
                        </div>
                        <button class="btn btn-sm btn-outline" @click="clearResults">Clear</button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="results-list">
                        <div v-for="(result, index) in results" :key="index" class="result-item" :class="resultItemClass(result)">
                            <div class="result-header" @click="toggleResultCollapse(result)">
                                <span class="collapse-icon">{{ result.collapsed ? "▶" : "▼" }}</span>
                                <span class="result-index">{{ index + 1 }}</span>
                                <span class="result-address">{{ formatAddress(result.call.target) }}</span>
                                <span class="result-method">{{ result.call.methodName }}</span>
                                <span v-if="result.call.args.length > 0" class="result-args">({{ result.call.args.map(formatArgDisplay).join(", ") }})</span>
                                <span class="result-status" :class="result.success ? 'success' : 'fail'">
                                    {{ result.success ? "✓" : "✗" }}
                                </span>
                            </div>
                            <div v-show="!result.collapsed" class="result-body">
                                <div v-if="result.success" class="result-values" :class="{ 'comparison-mode': showComparison(result) }">
                                    <!-- Custom/VNet Column -->
                                    <div class="result-column custom-column">
                                        <div class="column-header">
                                            <span class="env-badge custom">{{ customRpcUrl ? "🔮 Custom" : "Value" }}</span>
                                        </div>
                                        <div class="column-content">
                                            <ResultValueDisplay
                                                :value="result.customValue"
                                                :output-types="result.call.outputTypes"
                                                :chain-id="effectiveChainId"
                                                :decimals-map="result.decimalsMap || {}"
                                                :item-index="0"
                                                :compare-value="showComparison(result) ? result.productionValue : null"
                                                @update:decimals="(idx, val) => updateResultDecimals(result, idx, val)"
                                            />
                                        </div>
                                    </div>
                                    <!-- Production Column -->
                                    <div v-if="showComparison(result)" class="result-column production-column">
                                        <div class="column-header">
                                            <span class="env-badge production">🌐 Production</span>
                                            <span v-if="!result.valuesMatch" class="diff-badge">DIFF</span>
                                            <span v-else class="match-badge">MATCH</span>
                                        </div>
                                        <div class="column-content">
                                            <ResultValueDisplay
                                                :value="result.productionValue"
                                                :output-types="result.call.outputTypes"
                                                :chain-id="effectiveChainId"
                                                :decimals-map="result.decimalsMap || {}"
                                                :item-index="0"
                                                @update:decimals="(idx, val) => updateResultDecimals(result, idx, val)"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div v-else class="result-error">
                                    <span class="error-label">Error:</span>
                                    <span class="error-message">{{ result.customError || "Call failed" }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import PageHeader from "@/components/layout/PageHeader.vue";
import ResultValueDisplay from "@/components/common/ResultValueDisplay.vue";
import { useLoading } from "@/composables/useLoading";
import { isValidAddress, toChecksumAddress, formatAddress as formatAddr } from "@/utils/ethereum";
import { getRpcUrl, getChainName, getChainIds, getExplorerUrl } from "@/utils/chains";
import { getVnetDefaultAddresses, getAddressDisplayName } from "@/utils/cacheManager";
import { fetchContractABI, parseAbiToMethods, hasAbi, getContractMethods } from "@/utils/abiFetcher";
import { batchCall, batchCallWithComparison, formatValue, parseWithDecimals } from "@/utils/multicall";

// ============================================================================
// PRESET METHODS
// ============================================================================

const presetMethods = [
    // ERC20
    {
        category: "ERC20",
        name: "name",
        signature: "name()",
        inputs: "",
        outputs: "string",
        inputTypes: [],
        outputTypes: ["string"],
        inputNames: [],
        outputNames: [],
    },
    {
        category: "ERC20",
        name: "symbol",
        signature: "symbol()",
        inputs: "",
        outputs: "string",
        inputTypes: [],
        outputTypes: ["string"],
        inputNames: [],
        outputNames: [],
    },
    {
        category: "ERC20",
        name: "decimals",
        signature: "decimals()",
        inputs: "",
        outputs: "uint8",
        inputTypes: [],
        outputTypes: ["uint8"],
        inputNames: [],
        outputNames: [],
    },
    {
        category: "ERC20",
        name: "totalSupply",
        signature: "totalSupply()",
        inputs: "",
        outputs: "uint256",
        inputTypes: [],
        outputTypes: ["uint256"],
        inputNames: [],
        outputNames: [],
    },
    {
        category: "ERC20",
        name: "balanceOf",
        signature: "balanceOf(address)",
        inputs: "address",
        outputs: "uint256",
        inputTypes: ["address"],
        outputTypes: ["uint256"],
        inputNames: ["account"],
        outputNames: [],
    },
    {
        category: "ERC20",
        name: "allowance",
        signature: "allowance(address,address)",
        inputs: "address,address",
        outputs: "uint256",
        inputTypes: ["address", "address"],
        outputTypes: ["uint256"],
        inputNames: ["owner", "spender"],
        outputNames: [],
    },
    // ERC721
    {
        category: "ERC721",
        name: "ownerOf",
        signature: "ownerOf(uint256)",
        inputs: "uint256",
        outputs: "address",
        inputTypes: ["uint256"],
        outputTypes: ["address"],
        inputNames: ["tokenId"],
        outputNames: [],
    },
    {
        category: "ERC721",
        name: "tokenURI",
        signature: "tokenURI(uint256)",
        inputs: "uint256",
        outputs: "string",
        inputTypes: ["uint256"],
        outputTypes: ["string"],
        inputNames: ["tokenId"],
        outputNames: [],
    },
    // DeFi
    {
        category: "DeFi",
        name: "getReserves",
        signature: "getReserves()",
        inputs: "",
        outputs: "uint112,uint112,uint32",
        inputTypes: [],
        outputTypes: ["uint112", "uint112", "uint32"],
        inputNames: [],
        outputNames: ["reserve0", "reserve1", "blockTimestampLast"],
    },
    {
        category: "DeFi",
        name: "token0",
        signature: "token0()",
        inputs: "",
        outputs: "address",
        inputTypes: [],
        outputTypes: ["address"],
        inputNames: [],
        outputNames: [],
    },
    {
        category: "DeFi",
        name: "token1",
        signature: "token1()",
        inputs: "",
        outputs: "address",
        inputTypes: [],
        outputTypes: ["address"],
        inputNames: [],
        outputNames: [],
    },
    // Safe
    {
        category: "Safe",
        name: "getOwners",
        signature: "getOwners()",
        inputs: "",
        outputs: "address[]",
        inputTypes: [],
        outputTypes: ["address[]"],
        inputNames: [],
        outputNames: [],
    },
    {
        category: "Safe",
        name: "getThreshold",
        signature: "getThreshold()",
        inputs: "",
        outputs: "uint256",
        inputTypes: [],
        outputTypes: ["uint256"],
        inputNames: [],
        outputNames: [],
    },
    {
        category: "Safe",
        name: "nonce",
        signature: "nonce()",
        inputs: "",
        outputs: "uint256",
        inputTypes: [],
        outputTypes: ["uint256"],
        inputNames: [],
        outputNames: [],
    },
    // Access
    {
        category: "Access",
        name: "owner",
        signature: "owner()",
        inputs: "",
        outputs: "address",
        inputTypes: [],
        outputTypes: ["address"],
        inputNames: [],
        outputNames: [],
    },
    {
        category: "Access",
        name: "paused",
        signature: "paused()",
        inputs: "",
        outputs: "bool",
        inputTypes: [],
        outputTypes: ["bool"],
        inputNames: [],
        outputNames: [],
    },
    {
        category: "Access",
        name: "hasRole",
        signature: "hasRole(bytes32,address)",
        inputs: "bytes32,address",
        outputs: "bool",
        inputTypes: ["bytes32", "address"],
        outputTypes: ["bool"],
        inputNames: ["role", "account"],
        outputNames: [],
    },
];

// ============================================================================
// STATE
// ============================================================================

const route = useRoute();
const { error, setError, reset: clearError } = useLoading();

// RPC Connection
const selectedChainId = ref("");
const customRpcUrl = ref("");
const detectedChainId = ref("");
const compareWithProduction = ref(true);
const connecting = ref(false);
const isRpcLocked = ref(false);
const rpcUrl = ref(""); // Actual RPC URL to use
const productionRpcUrl = ref("");

// Address & Method Selection
const urlAddresses = ref([]);
const favoriteAddresses = ref([]);
const selectedAddressOption = ref("");
const targetAddress = ref("");
const loadingAbi = ref(false);
const contractAbiMethods = ref([]); // Methods from contract ABI

// Method input
const methodSearch = ref("");
const showMethodSuggestions = ref(false);
const selectedMethod = ref(null);
const paramValues = ref([]);
const paramDecimals = ref([]);
const methodInputWrapper = ref(null);
const suggestionDropdownStyle = ref({});

// Call Queue
const callQueue = ref([]);

// Execution
const executing = ref(false);
const results = ref([]);

// ============================================================================
// COMPUTED
// ============================================================================

const availableChains = computed(() => {
    return getChainIds().map((id) => ({
        id,
        name: getChainName(id),
    }));
});

const effectiveChainId = computed(() => detectedChainId.value || selectedChainId.value);

const detectedChainName = computed(() => {
    if (!detectedChainId.value) return "";
    return getChainName(detectedChainId.value) || `Chain ${detectedChainId.value}`;
});

const hasProductionRpc = computed(() => {
    if (!effectiveChainId.value) return false;
    return !!getRpcUrl(effectiveChainId.value);
});

const connectionStatusClass = computed(() => {
    if (isRpcLocked.value) return "connected";
    if (connecting.value) return "connecting";
    return "disconnected";
});

const connectionStatusText = computed(() => {
    if (connecting.value) return "Connecting...";
    if (isRpcLocked.value) {
        const mode = customRpcUrl.value ? (compareWithProduction.value && productionRpcUrl.value ? "Comparison Mode" : "Custom RPC") : "Production RPC";
        return `Connected to ${detectedChainName.value || getChainName(effectiveChainId.value)} (${mode})`;
    }
    return selectedChainId.value ? "Ready to connect" : "Select a chain or enter RPC URL";
});

const addressOptions = computed(() => {
    const all = [];
    const seen = new Set();

    for (const addr of urlAddresses.value) {
        const key = addr.address.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            all.push(addr);
        }
    }

    for (const addr of favoriteAddresses.value) {
        const key = addr.address.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            all.push(addr);
        }
    }

    return all;
});

const hasLoadedAbi = computed(() => {
    if (!targetAddress.value || !isValidAddress(targetAddress.value)) return false;
    return hasAbi(effectiveChainId.value, targetAddress.value);
});

// Combined methods: ABI methods + preset methods
const allMethods = computed(() => {
    const methods = [];

    // Add ABI methods first (higher priority)
    for (const m of contractAbiMethods.value) {
        methods.push({ ...m, fromAbi: true });
    }

    // Add presets
    for (const p of presetMethods) {
        // Skip if already in ABI methods
        if (!methods.some((m) => m.signature === p.signature)) {
            methods.push({ ...p, fromAbi: false });
        }
    }

    return methods;
});

const filteredMethods = computed(() => {
    if (!methodSearch.value) {
        return allMethods.value.slice(0, 20);
    }

    const q = methodSearch.value.toLowerCase();
    return allMethods.value.filter((m) => m.name.toLowerCase().includes(q) || m.signature.toLowerCase().includes(q)).slice(0, 20);
});

const canAddCall = computed(() => {
    if (!isValidAddress(targetAddress.value) || !selectedMethod.value) {
        return false;
    }
    // Check if all required parameters are filled
    const inputTypes = selectedMethod.value.inputTypes || [];
    if (inputTypes.length > 0) {
        for (let i = 0; i < inputTypes.length; i++) {
            const val = paramValues.value[i];
            if (val === undefined || val === null || val === "") {
                return false;
            }
        }
    }
    return true;
});

const successCount = computed(() => results.value.filter((r) => r.success).length);
const failCount = computed(() => results.value.filter((r) => !r.success).length);
const mismatchCount = computed(() => results.value.filter((r) => r.success && !r.valuesMatch).length);

// ============================================================================
// METHODS
// ============================================================================

function formatAddressOption(addr) {
    const display = addr.symbol || addr.customName || addr.name;
    if (display) {
        return `${display} (${formatAddr(addr.address)})`;
    }
    return addr.address;
}

function formatAddress(addr) {
    return formatAddr(addr, 6, 4);
}

function formatArgDisplay(arg) {
    if (typeof arg === "string" && arg.length > 20) {
        return arg.slice(0, 8) + "..." + arg.slice(-6);
    }
    return String(arg);
}

function getParamPlaceholder(type) {
    if (type === "address") return "0x...";
    if (type.startsWith("uint") || type.startsWith("int")) return "Enter number...";
    if (type === "bool") return "true or false";
    if (type.startsWith("bytes32")) return "0x... (32 bytes)";
    if (type.startsWith("bytes")) return "0x...";
    if (type === "string") return "Enter string...";
    if (type.includes("[]")) return "JSON array: [1, 2, 3]";
    return `Enter ${type}...`;
}

function isNumericType(type) {
    return type.startsWith("uint") || type.startsWith("int");
}

function loadFavoriteAddresses() {
    if (!effectiveChainId.value) return;
    const favorites = getVnetDefaultAddresses(effectiveChainId.value);
    favoriteAddresses.value = favorites.map((f) => ({
        address: f.address,
        symbol: f.symbol,
        name: f.name,
        customName: f.customName,
    }));
}

function updateUrlAddressSymbols(chainId) {
    for (const addr of urlAddresses.value) {
        const displayName = getAddressDisplayName(addr.address, chainId);
        if (displayName) {
            addr.symbol = displayName;
        }
    }
}

// ============================================================================
// RPC CONNECTION
// ============================================================================

async function connectRpc() {
    if (isRpcLocked.value) return;

    connecting.value = true;
    clearError();

    try {
        const ethers = window.ethers;
        if (!ethers) throw new Error("ethers.js not loaded");

        let targetRpcUrl = customRpcUrl.value.trim();
        let chainId = selectedChainId.value;

        // If custom RPC provided, detect chain ID
        if (targetRpcUrl) {
            console.log("[ContractReader] Connecting to custom RPC:", targetRpcUrl);
            const provider = new ethers.providers.JsonRpcProvider(targetRpcUrl);
            const network = await provider.getNetwork();
            chainId = network.chainId.toString();
            console.log("[ContractReader] Detected chainId:", chainId);

            detectedChainId.value = chainId;
            selectedChainId.value = chainId;
            rpcUrl.value = targetRpcUrl;

            // Always set up production RPC for comparison when using custom RPC
            const prodRpc = getRpcUrl(chainId);
            if (prodRpc) {
                productionRpcUrl.value = prodRpc;
                compareWithProduction.value = true;
            } else {
                productionRpcUrl.value = "";
                compareWithProduction.value = false;
            }
        } else if (chainId) {
            // Use production RPC
            const prodRpc = getRpcUrl(chainId);
            if (!prodRpc) throw new Error("No RPC URL available for this chain");
            rpcUrl.value = prodRpc;
            detectedChainId.value = chainId;
            productionRpcUrl.value = "";
            compareWithProduction.value = false;
        } else {
            throw new Error("Please select a chain or enter a custom RPC URL");
        }

        // Lock RPC - cannot change after connecting
        isRpcLocked.value = true;

        // Load addresses
        loadFavoriteAddresses();
        if (urlAddresses.value.length > 0) {
            updateUrlAddressSymbols(chainId);
        }

        console.log("[ContractReader] Connected successfully");
    } catch (e) {
        console.error("[ContractReader] Connection error:", e);
        setError(`Connection failed: ${e.message}`);
    } finally {
        connecting.value = false;
    }
}

function resetConnection() {
    isRpcLocked.value = false;
    detectedChainId.value = "";
    rpcUrl.value = "";
    productionRpcUrl.value = "";
    callQueue.value = [];
    results.value = [];
    clearError();
}

function onChainChange() {
    if (!isRpcLocked.value && !customRpcUrl.value && selectedChainId.value) {
        // Pre-load favorites for selected chain
        loadFavoriteAddresses();
    }
}

// ============================================================================
// ADDRESS HANDLING
// ============================================================================

function onAddressSelect() {
    if (selectedAddressOption.value) {
        targetAddress.value = selectedAddressOption.value;
        onAddressBlur();
    }
}

async function onAddressBlur() {
    const addr = targetAddress.value.trim();
    if (!isValidAddress(addr)) return;

    // Checksum address
    try {
        targetAddress.value = toChecksumAddress(addr);
    } catch {}

    // Load ABI if not already loaded
    if (!hasAbi(effectiveChainId.value, addr)) {
        loadingAbi.value = true;
        try {
            const result = await fetchContractABI(effectiveChainId.value, addr);
            if (result.abi) {
                contractAbiMethods.value = parseAbiToMethods(result.abi);
                console.log("[ContractReader] Loaded ABI methods:", contractAbiMethods.value.length);
            } else {
                contractAbiMethods.value = [];
            }
        } catch (e) {
            console.warn("[ContractReader] Failed to load ABI:", e.message);
            contractAbiMethods.value = [];
        } finally {
            loadingAbi.value = false;
        }
    } else {
        // Load from cache
        contractAbiMethods.value = getContractMethods(effectiveChainId.value, addr);
    }
}

// ============================================================================
// METHOD SELECTION
// ============================================================================

function onMethodSearchInput() {
    showMethodSuggestions.value = true;

    // Try to parse as custom signature
    const input = methodSearch.value.trim();
    if (input.includes("(") && input.includes(")")) {
        const parsed = parseMethodSignature(input);
        if (parsed) {
            selectedMethod.value = parsed;
            paramValues.value = new Array(parsed.inputTypes.length).fill("");
            paramDecimals.value = new Array(parsed.inputTypes.length).fill(0);
        }
    } else {
        selectedMethod.value = null;
    }
}

function parseMethodSignature(sig) {
    // Parse signature like "balanceOf(address)" or "balanceOf(address)(uint256)"
    const match = sig.match(/^(\w+)\(([^)]*)\)(?:\(([^)]*)\))?$/);
    if (!match) return null;

    const name = match[1];
    const inputs = match[2];
    const outputs = match[3] || "";

    const inputTypes = inputs
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    const outputTypes = outputs
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

    return {
        name,
        signature: `${name}(${inputs})`,
        inputs,
        outputs,
        inputTypes,
        outputTypes,
        inputNames: inputTypes.map((_, i) => `arg${i}`),
        outputNames: [],
    };
}

function selectMethod(method) {
    selectedMethod.value = method;
    methodSearch.value = method.signature;
    showMethodSuggestions.value = false;
    paramValues.value = new Array(method.inputTypes.length).fill("");
    paramDecimals.value = new Array(method.inputTypes.length).fill(0);
}

function selectFirstSuggestion() {
    if (filteredMethods.value.length > 0) {
        selectMethod(filteredMethods.value[0]);
    }
}

function openMethodSuggestions() {
    // Calculate position based on input element
    if (methodInputWrapper.value) {
        const rect = methodInputWrapper.value.getBoundingClientRect();
        suggestionDropdownStyle.value = {
            position: "fixed",
            top: `${rect.bottom + 2}px`,
            left: `${rect.left}px`,
            width: `${rect.width}px`,
        };
    }
    showMethodSuggestions.value = true;
}

function hideMethodSuggestionsDelayed() {
    setTimeout(() => {
        showMethodSuggestions.value = false;
    }, 200);
}

// ============================================================================
// CALL QUEUE
// ============================================================================

function addCallToQueue() {
    if (!canAddCall.value) return;

    // Process parameter values
    const args = selectedMethod.value.inputTypes.map((type, index) => {
        let value = paramValues.value[index] || "";

        // Apply decimals for numeric types
        if (isNumericType(type) && paramDecimals.value[index] > 0) {
            value = parseWithDecimals(value, paramDecimals.value[index]);
        }

        // Parse arrays/booleans
        if (type.includes("[]")) {
            try {
                value = JSON.parse(value);
            } catch {}
        } else if (type === "bool") {
            value = value.toLowerCase() === "true";
        }

        return value;
    });

    callQueue.value.push({
        target: targetAddress.value,
        methodName: selectedMethod.value.name,
        signature: selectedMethod.value.signature,
        args,
        outputs: selectedMethod.value.outputs,
        outputTypes: selectedMethod.value.outputTypes,
    });

    // Clear method input for next call
    methodSearch.value = "";
    selectedMethod.value = null;
    paramValues.value = [];
    paramDecimals.value = [];
}

function removeFromQueue(index) {
    callQueue.value.splice(index, 1);
}

function clearQueue() {
    callQueue.value = [];
}

function clearResults() {
    results.value = [];
}

// ============================================================================
// EXECUTION
// ============================================================================

async function executeQueue() {
    if (callQueue.value.length === 0) return;

    executing.value = true;
    clearError();

    try {
        // Build calls for multicall
        const calls = callQueue.value.map((call) => ({
            target: call.target,
            signature: call.signature,
            args: call.args,
            outputs: call.outputs,
            allowFailure: true,
        }));

        let batchResults;

        if (compareWithProduction.value && productionRpcUrl.value) {
            // Execute with comparison
            batchResults = await batchCallWithComparison(rpcUrl.value, productionRpcUrl.value, calls);
        } else {
            // Execute on single RPC
            const rawResults = await batchCall(rpcUrl.value, calls);
            batchResults = rawResults.map((r) => ({
                ...r,
                customValue: r.value,
                productionValue: null,
                customError: r.error,
                productionError: null,
                valuesMatch: true,
            }));
        }

        // Attach call info to results and prepend to history
        const newResults = batchResults.map((result, index) => ({
            ...result,
            call: callQueue.value[index],
            decimalsMap: {},
            collapsed: false,
        }));

        // Prepend new results to existing results (keep history)
        results.value = [...newResults, ...results.value];

        // Clear queue after execution
        callQueue.value = [];

        // Clear current method selection
        methodSearch.value = "";
        selectedMethod.value = null;
        paramValues.value = [];
        paramDecimals.value = [];

        console.log("[ContractReader] Execution complete:", results.value);
    } catch (e) {
        console.error("[ContractReader] Execution error:", e);
        setError(`Execution failed: ${e.message}`);
    } finally {
        executing.value = false;
    }
}

function formatResultValue(value, outputs) {
    if (value === null || value === undefined) return "null";
    return formatValue(value);
}

function resultItemClass(result) {
    if (!result.success) return "result-failed";
    if (compareWithProduction.value && !result.valuesMatch) return "result-mismatch";
    return "result-success";
}

function showComparison(result) {
    return customRpcUrl.value && productionRpcUrl.value && result.productionValue !== null && result.productionValue !== undefined;
}

function toggleResultCollapse(result) {
    result.collapsed = !result.collapsed;
}

function updateResultDecimals(result, itemIndex, value) {
    if (!result.decimalsMap) {
        result.decimalsMap = {};
    }
    result.decimalsMap[itemIndex] = value;
}

// ============================================================================
// LIFECYCLE
// ============================================================================

onMounted(async () => {
    const query = route.query;

    // Parse URL params
    if (query.rpc) {
        customRpcUrl.value = decodeURIComponent(query.rpc);
    }

    if (query.addresses) {
        const addrList = decodeURIComponent(query.addresses).split(",").filter(Boolean);
        urlAddresses.value = addrList.map((a) => {
            try {
                return { address: toChecksumAddress(a), symbol: null };
            } catch {
                return { address: a, symbol: null };
            }
        });
    }

    if (query.chainId) {
        selectedChainId.value = query.chainId;
    }

    // Auto-connect if RPC provided (e.g., from payload page)
    if (customRpcUrl.value || selectedChainId.value) {
        await connectRpc();
    }
});
</script>

<style scoped>
.reader-container {
    max-width: 900px;
}

/* RPC Collapsed State */
.card-collapsed {
    background: var(--color-surface);
}

.rpc-collapsed {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    gap: 1rem;
}

.rpc-collapsed-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
}

.rpc-collapsed-info .chain-name {
    font-weight: 600;
    font-size: 1rem;
}

.custom-rpc-badge,
.production-badge,
.compare-badge {
    font-size: 0.8rem;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    background: var(--color-surface-hover);
}

.custom-rpc-badge {
    color: var(--color-primary);
}

.compare-badge {
    background: rgba(var(--color-success-rgb), 0.15);
    color: var(--color-success);
}

/* RPC Section */
.rpc-row {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
}

.rpc-field {
    flex: 1;
    min-width: 200px;
}

.chain-field {
    max-width: 250px;
}

.rpc-input-field {
    flex: 2;
}

.chain-select-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.chain-lock-badge {
    font-size: 0.8rem;
    color: var(--color-primary);
    white-space: nowrap;
}

.rpc-input-wrapper {
    display: flex;
    gap: 0.5rem;
}

.rpc-input-wrapper .input {
    flex: 1;
}

.rpc-actions-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1rem;
    flex-wrap: wrap;
    gap: 1rem;
}

.rpc-buttons {
    display: flex;
    gap: 0.5rem;
}

.toggle-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
}

.connection-status-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 1rem;
    flex-wrap: wrap;
}

.status-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.status-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
}

.status-indicator.connected {
    background: var(--color-success);
}

.status-indicator.connecting {
    background: var(--color-warning);
    animation: pulse 1s infinite;
}

.status-indicator.disconnected {
    background: var(--color-muted);
}

.status-error {
    color: var(--color-error);
    font-size: 0.9rem;
}

.header-badge {
    font-size: 0.8rem;
    padding: 0.2rem 0.5rem;
    background: var(--color-surface-hover);
    border-radius: 4px;
}

/* Address & Method Selection */
.form-group {
    margin-bottom: 1rem;
}

.method-selection-group {
    min-height: 120px;
    overflow: visible;
    position: relative;
    z-index: 10;
}

.address-input-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
}

.address-select {
    max-width: 200px;
}

.address-input-row .input {
    flex: 1;
}

.abi-status {
    font-size: 1rem;
}

.abi-status.loading {
    animation: pulse 1s infinite;
}

.abi-status.loaded {
    color: var(--color-success);
}

/* Method Input */
.method-input-row {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
}

.add-call-btn {
    white-space: nowrap;
    height: 38px;
}

.method-search-wrapper {
    position: relative;
    flex: 1;
}

/* Method Suggestions - Portal version (rendered in body) */
.method-suggestions-portal {
    position: fixed;
    background-color: white !important;
    color: black !important;
    border: 2px solid #333;
    border-radius: 6px;
    max-height: 350px;
    overflow-y: auto;
    z-index: 99999;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    opacity: 1 !important;
}

.method-suggestions-portal .suggestion-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.85rem;
    cursor: pointer;
    border-bottom: 1px solid #ddd;
    background-color: white !important;
    color: black !important;
}

.method-suggestions-portal .suggestion-item:hover {
    background-color: #f0f0f0 !important;
}

.method-suggestions-portal .suggestion-item.from-abi {
    background-color: #e8f4fc !important;
}

.method-suggestions-portal .suggestion-item.from-abi:hover {
    background-color: #d0e8f8 !important;
}

.method-suggestions-portal .suggestion-name {
    font-weight: 600;
    color: #111 !important;
}

.method-suggestions-portal .suggestion-sig {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    color: #666 !important;
    flex: 1;
}

.method-suggestions-portal .suggestion-badge {
    font-size: 0.7rem;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    background: #0066cc;
    color: white !important;
}

.method-suggestions-portal .suggestion-badge.preset {
    background: #888;
}

.suggestion-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    border-bottom: 1px solid var(--color-border);
}

.suggestion-item:hover {
    background: var(--color-surface-hover);
}

.suggestion-item.from-abi {
    background: rgba(var(--color-primary-rgb), 0.05);
}

.suggestion-name {
    font-weight: 500;
}

.suggestion-sig {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    color: var(--color-muted);
    flex: 1;
}

.suggestion-badge {
    font-size: 0.7rem;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    background: var(--color-primary);
    color: white;
}

.suggestion-badge.preset {
    background: var(--color-muted);
}

.selected-method-info {
    margin-top: 0.5rem;
    font-size: 0.9rem;
}

.selected-method-info code {
    background: var(--color-surface-hover);
    padding: 0.2rem 0.4rem;
    border-radius: 3px;
}

/* Parameters */
.params-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.param-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.param-type {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    color: var(--color-primary);
    min-width: 80px;
}

.param-name {
    font-size: 0.85rem;
    color: var(--color-muted);
}

.param-input-wrapper {
    display: flex;
    gap: 0.5rem;
    flex: 1;
}

.param-input {
    flex: 1;
}

.param-decimals {
    width: 70px;
}

.form-actions {
    margin-top: 1rem;
}

/* Call Queue */
.call-queue {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.queue-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    background: var(--color-surface-hover);
    border-radius: 4px;
}

.queue-item-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.queue-index {
    font-weight: bold;
    color: var(--color-muted);
    min-width: 20px;
}

.queue-address {
    font-family: var(--font-mono);
    font-size: 0.85rem;
}

.queue-method {
    font-weight: 500;
    color: var(--color-primary);
}

.queue-args {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    color: var(--color-muted);
}

.queue-actions {
    margin-top: 1rem;
    display: flex;
    justify-content: center;
}

/* Results */
.result-header-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.result-summary {
    display: flex;
    gap: 1rem;
    font-size: 0.9rem;
}

.summary-success {
    color: var(--color-success);
}

.summary-fail {
    color: var(--color-error);
}

.summary-mismatch {
    color: var(--color-warning);
}

.results-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.result-item {
    border: 1px solid var(--color-border);
    border-radius: 6px;
    overflow: hidden;
}

.result-item.result-success {
    border-left: 3px solid var(--color-success);
}

.result-item.result-failed {
    border-left: 3px solid var(--color-error);
}

.result-item.result-mismatch {
    border-left: 3px solid var(--color-warning);
}

.result-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-surface-hover);
    flex-wrap: wrap;
    cursor: pointer;
    user-select: none;
}

.result-header:hover {
    background: var(--color-bg-hover);
}

.collapse-icon {
    font-size: 0.7rem;
    color: var(--color-muted);
    width: 12px;
    text-align: center;
}

.result-index {
    font-weight: bold;
    color: var(--color-muted);
    min-width: 20px;
}

.result-address {
    font-family: var(--font-mono);
    font-size: 0.85rem;
}

.result-method {
    font-weight: 500;
}

.result-args {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    color: var(--color-muted);
}

.result-status {
    margin-left: auto;
}

.result-status.success {
    color: var(--color-success);
}

.result-status.fail {
    color: var(--color-error);
}

.result-body {
    padding: 0.75rem;
}

.result-values {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.result-values.comparison-mode {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
}

.result-column {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    border-radius: 6px;
    background: var(--color-bg-alt);
}

.result-column.custom-column {
    border-left: 3px solid var(--color-primary);
}

.result-column.production-column {
    border-left: 3px solid var(--color-secondary);
}

.column-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
}

.column-content {
    font-size: 0.9rem;
}

.env-badge {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
}

.env-badge.custom {
    background: rgba(59, 130, 246, 0.15);
    color: var(--color-primary);
}

.env-badge.production {
    background: rgba(139, 92, 246, 0.15);
    color: var(--color-secondary);
}

.diff-badge {
    background: var(--color-error);
    color: white;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    font-size: 0.65rem;
    font-weight: 600;
    margin-left: auto;
}

.match-badge {
    background: var(--color-success);
    color: white;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    font-size: 0.65rem;
    font-weight: 600;
    margin-left: auto;
}

.result-error {
    color: var(--color-error);
}

.error-label {
    font-weight: 500;
}

/* Responsive: Stack columns on mobile */
@media (max-width: 768px) {
    .result-values.comparison-mode {
        grid-template-columns: 1fr;
    }
}

.mono {
    font-family: var(--font-mono);
}

.text-muted {
    color: var(--color-muted);
}

.text-sm {
    font-size: 0.85rem;
}

.btn-lg {
    padding: 0.75rem 2rem;
    font-size: 1.1rem;
}

@keyframes pulse {
    0%,
    100% {
        opacity: 1;
    }
    50% {
        opacity: 0.5;
    }
}
</style>
