<template>
    <div class="params-container">
        <div v-for="(param, idx) in params" :key="idx" class="param-item">
            <!-- Parameter label: type (name): -->
            <div class="param-label">
                <strong>{{ param.type }}</strong>
                <span v-if="param.name" class="param-name">({{ param.name }})</span>:
            </div>

            <!-- Parameter value -->
            <div class="param-value">
                <!-- Address type -->
                <template v-if="isAddress(param.type, param.value)">
                    <span class="address-display" :data-address="checksumAddr(param.value)">
                        <a :href="explorerAddressUrl(param.value)" target="_blank" rel="noopener">{{ checksumAddr(param.value) }}</a>
                        <span v-if="getAddrName(param.value)" class="address-symbol">{{ getAddrName(param.value) }}</span>
                        <button type="button" class="copy-btn" @click="copy(checksumAddr(param.value))">copy</button>
                    </span>
                </template>

                <!-- Address array -->
                <template v-else-if="isAddressArray(param.type, param.value)">
                    <div v-if="!param.value?.length" class="empty-array">[]</div>
                    <template v-else>
                        <div class="array-container">[</div>
                        <div v-for="(item, i) in param.value" :key="i" class="array-item">
                            <span class="address-display" :data-address="checksumAddr(item)">
                                <a :href="explorerAddressUrl(item)" target="_blank" rel="noopener">{{ checksumAddr(item) }}</a>
                                <span v-if="getAddrName(item)" class="address-symbol">{{ getAddrName(item) }}</span>
                                <button type="button" class="copy-btn" @click="copy(checksumAddr(item))">copy</button>
                            </span>
                        </div>
                        <div class="array-container">]</div>
                    </template>
                </template>

                <!-- Uint256 array -->
                <template v-else-if="isUintArray(param.type, param.value)">
                    <div v-if="!param.value?.length" class="empty-array">[]</div>
                    <template v-else>
                        <div class="array-container">[</div>
                        <div v-for="(item, i) in param.value" :key="i" class="array-item">
                            <span class="uint256-value">{{ formatUint(item) }}</span>
                            <template v-if="isBigUint(item)">
                                <select class="decimal-select" @change="(e) => onDecimalChange(e, item)">
                                    <option value="0">0</option>
                                    <option value="6">6</option>
                                    <option value="8">8</option>
                                    <option value="18" selected>18</option>
                                </select>
                                <span class="formatted-value">{{ formatWithDecimals(item, 18) }}</span>
                            </template>
                        </div>
                        <div class="array-container">]</div>
                    </template>
                </template>

                <!-- Bytes array -->
                <template v-else-if="isBytesArray(param.type, param.value)">
                    <div v-if="!param.value?.length" class="empty-array">[]</div>
                    <template v-else>
                        <div class="array-container">[</div>
                        <div v-for="(item, i) in param.value" :key="i" class="array-item">
                            <template v-if="param.decodedArray?.[i]">
                                <div class="decoded-bytes-header">
                                    → {{ param.decodedArray[i].signature }}
                                    <button type="button" class="copy-btn raw-copy" @click="copy(item)">copy raw data</button>
                                </div>
                                <!-- Nested Safe / multicall results have transactions/calls, not params -->
                                <template v-if="param.decodedArray[i].transactions?.length">
                                    <SafeTransactionCard
                                        v-for="(t, ti) in param.decodedArray[i].transactions"
                                        :key="'st-' + ti"
                                        :transaction="t"
                                        :index="ti"
                                        :chain-id="chainId"
                                    />
                                </template>
                                <template v-else-if="param.decodedArray[i].calls?.length">
                                    <MulticallCard
                                        v-for="(c, ci) in param.decodedArray[i].calls"
                                        :key="'mc-' + ci"
                                        :call="c"
                                        :index="ci"
                                        :chain-id="chainId"
                                    />
                                </template>
                                <ParameterList
                                    v-else-if="param.decodedArray[i].params?.length"
                                    :params="param.decodedArray[i].params"
                                    :chain-id="chainId"
                                    :depth="depth + 1"
                                />
                            </template>
                            <template v-else>
                                <span class="bytes-display">
                                    <span class="bytes-value">{{ truncateBytes(item) }}</span>
                                    <button type="button" class="copy-btn" @click="copy(item)">copy</button>
                                </span>
                            </template>
                        </div>
                        <div class="array-container">]</div>
                    </template>
                </template>

                <!-- Tuple array (with itemComponents) -->
                <template v-else-if="param.itemComponents?.length && Array.isArray(param.value)">
                    <div v-if="!param.value?.length" class="empty-array">[]</div>
                    <template v-else>
                        <div class="array-container">[</div>
                        <div v-for="(item, i) in param.value" :key="i" class="array-item">
                            <div class="tuple-container">(</div>
                            <ParameterList v-if="param.itemComponents[i]" :params="param.itemComponents[i]" :chain-id="chainId" :depth="depth + 1" />
                            <div v-else class="default-value">{{ formatValue(item) }}</div>
                            <div class="tuple-container">)</div>
                        </div>
                        <div class="array-container">]</div>
                    </template>
                </template>

                <!-- Generic array -->
                <template v-else-if="Array.isArray(param.value) && !param.components">
                    <div v-if="!param.value?.length" class="empty-array">[]</div>
                    <template v-else>
                        <div class="array-container">[</div>
                        <div v-for="(item, i) in param.value" :key="i" class="array-item">
                            <!-- Nested array: render each sub-item on its own line -->
                            <template v-if="Array.isArray(item)">
                                <div class="nested-array">
                                    <div class="array-container">[</div>
                                    <div v-for="(subItem, j) in item" :key="j" class="array-item">
                                        <span class="default-value">{{ formatValue(subItem) }}</span>
                                    </div>
                                    <div class="array-container">]</div>
                                </div>
                            </template>
                            <template v-else>
                                <span class="default-value">{{ formatValue(item) }}</span>
                            </template>
                        </div>
                        <div class="array-container">]</div>
                    </template>
                </template>

                <!-- MultiSend packed transactions -->
                <template v-else-if="param.isMultiSendPacked && param.packedTransactions">
                    <div v-for="(tx, i) in param.packedTransactions" :key="i" class="multisend-tx">
                        <div class="multisend-header">
                            <span class="tx-index">#{{ i + 1 }}</span>
                            <span class="function-name">{{ tx.decoded?.signature || "unknown" }}</span>
                            <span class="operation-info" :class="tx.operation === 1 ? 'delegatecall' : 'call'">
                                {{ tx.operation === 1 ? "delegatecall" : "call" }}
                            </span>
                        </div>
                        <div class="called-address" :data-address="checksumAddr(tx.address)">
                            <span class="address-label">To:</span>
                            <a :href="explorerAddressUrl(tx.address)" target="_blank" rel="noopener">{{ checksumAddr(tx.address) }}</a>
                            <span v-if="getAddrName(tx.address)" class="address-symbol">{{ getAddrName(tx.address) }}</span>
                        </div>
                        <div v-if="tx.value && tx.value !== '0'" class="call-value">
                            <div class="param-label">Value:</div>
                            <span class="uint256-value">{{ tx.value }}</span>
                        </div>
                        <ParameterList v-if="tx.decoded?.params?.length" :params="tx.decoded.params" :chain-id="chainId" :depth="depth + 1" />
                        <div v-else-if="tx.data && tx.data !== '0x'" class="raw-payload">
                            {{ truncateBytes(tx.data) }}
                            <button type="button" class="copy-btn raw-copy" @click="copy(tx.data)">copy raw data</button>
                        </div>
                    </div>
                </template>

                <!-- Bytes with decoded content -->
                <template v-else-if="param.decoded">
                    <div class="decoded-bytes">
                        <div class="decoded-bytes-header">
                            → {{ param.decoded.signature }}
                            <button type="button" class="copy-btn raw-copy" @click="copy(param.value)">copy raw data</button>
                        </div>
                        <!-- Nested Safe / multicall results have transactions/calls, not params,
                             so rendering only `.params` used to show an empty arrow row. -->
                        <template v-if="param.decoded.transactions?.length">
                            <SafeTransactionCard
                                v-for="(t, ti) in param.decoded.transactions"
                                :key="'st-' + ti"
                                :transaction="t"
                                :index="ti"
                                :chain-id="chainId"
                            />
                        </template>
                        <template v-else-if="param.decoded.calls?.length">
                            <MulticallCard
                                v-for="(c, ci) in param.decoded.calls"
                                :key="'mc-' + ci"
                                :call="c"
                                :index="ci"
                                :chain-id="chainId"
                            />
                        </template>
                        <ParameterList v-else-if="param.decoded.params?.length" :params="param.decoded.params" :chain-id="chainId" :depth="depth + 1" />
                    </div>
                </template>

                <!-- Tuple with components - render recursively -->
                <template v-else-if="param.components?.length">
                    <div class="tuple-container">(</div>
                    <ParameterList :params="param.components" :chain-id="chainId" :depth="depth + 1" />
                    <div class="tuple-container">)</div>
                </template>

                <!-- uint256 -->
                <template v-else-if="param.type.includes('uint')">
                    <span class="uint256-value">{{ formatUint(param.value) }}</span>
                    <template v-if="isBigUint(param.value)">
                        <select class="decimal-select" @change="(e) => onDecimalChange(e, param.value)">
                            <option value="0">0</option>
                            <option value="6">6</option>
                            <option value="8">8</option>
                            <option value="18" selected>18</option>
                        </select>
                        <span class="formatted-value">{{ formatWithDecimals(param.value, 18) }}</span>
                    </template>
                </template>

                <!-- int -->
                <template v-else-if="param.type.includes('int')">
                    <span class="int-value">{{ formatUint(param.value) }}</span>
                </template>

                <!-- bytes -->
                <template v-else-if="param.type.includes('bytes')">
                    <span class="bytes-display">
                        <span class="bytes-value">{{ param.value }}</span>
                        <button type="button" class="copy-btn" @click="copy(param.value)">copy</button>
                    </span>
                </template>

                <!-- bool -->
                <template v-else-if="param.type === 'bool'">
                    <span class="bool-value">{{ param.value ? "true" : "false" }}</span>
                </template>

                <!-- string -->
                <template v-else-if="param.type === 'string'">
                    <span class="string-value">{{ param.value }}</span>
                </template>

                <!-- default -->
                <template v-else>
                    <span class="default-value">{{ formatValue(param.value) }}</span>
                </template>
            </div>
        </div>
    </div>
</template>

<script setup>
import { defineAsyncComponent } from "vue";
import { useAddressDisplay, isAddress as isValidAddr } from "@/composables";

// Nested Safe / multicall rendering. Loaded lazily because those components
// import this one, and a static circular import can trip module initialization.
const SafeTransactionCard = defineAsyncComponent(() => import("./SafeTransactionCard.vue"));
const MulticallCard = defineAsyncComponent(() => import("./MulticallCard.vue"));

const props = defineProps({
    params: { type: Array, required: true },
    chainId: { type: String, default: "1" },
    depth: { type: Number, default: 0 },
});

// Use shared address display utilities - THE SINGLE SOURCE OF TRUTH
const { getName: getAddrName, getExplorerUrl: explorerAddressUrl, checksum: checksumAddr } = useAddressDisplay(() => props.chainId);

const isAddress = (type, value) => type === "address" && typeof value === "string" && isValidAddr(value);
const isAddressArray = (type, value) => type === "address[]" && Array.isArray(value);
const isUintArray = (type, value) => /^uint\d+\[\]$/.test(type) && Array.isArray(value);
const isBytesArray = (type, value) => /^bytes\d*\[\]$/.test(type) && Array.isArray(value);

const copy = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
    } catch {}
};

const formatUint = (value) => {
    if (value === null || value === undefined) return "0";
    if (typeof value === "bigint") return value.toString();
    return String(value);
};

const isBigUint = (value) => {
    const str = formatUint(value);
    return str.length >= 14 && !str.startsWith("0x");
};

const formatWithDecimals = (value, decimals) => {
    try {
        const str = formatUint(value);
        const num = BigInt(str.replace(/^0x/, ""));
        const denom = BigInt("1" + "0".repeat(decimals));
        const result = Number(num) / Number(denom);
        if (!isFinite(result)) return "";
        return result.toFixed(6).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    } catch {
        return "";
    }
};

// Update the formatted value span next to the select element
const onDecimalChange = (event, value) => {
    const decimals = parseInt(event.target.value);
    const span = event.target.nextElementSibling;
    if (span && span.classList.contains("formatted-value")) {
        span.textContent = formatWithDecimals(value, decimals);
    }
};

const truncateBytes = (hex) => {
    if (!hex) return "0x";
    if (hex === "0x") return "0x";
    return hex;
};

const formatValue = (value) => {
    if (value === null || value === undefined) return "";
    if (typeof value === "bigint") return value.toString();
    if (typeof value === "object") return JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v));
    return String(value);
};
</script>

<style scoped>
/* Match reference styles exactly */
.params-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.param-item {
    padding: 8px;
    background: var(--color-bg-tertiary, #f5f5f5);
    border-radius: 4px;
}

.param-label {
    font-size: 12px;
    margin-bottom: 4px;
}

.param-label strong {
    color: var(--color-secondary, #6a1b9a);
}

.param-name {
    color: var(--color-text-muted, #757575);
    font-style: italic;
}

.param-value {
    font-family: "SF Mono", "Monaco", "Inconsolata", "Roboto Mono", monospace;
    font-size: 14px;
    word-break: break-all;
}

/* Address display */
.address-display {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    font-size: 14px;
}

.address-display a {
    color: var(--color-text-primary, #212121);
    text-decoration: none;
}

.address-display a:hover {
    text-decoration: underline;
}

.address-symbol {
    color: var(--color-primary, #1565c0);
    font-size: 13px;
    font-weight: 500;
    margin-left: 2px;
}

/* Called address (in multiSend) */
.called-address {
    margin-top: 4px;
    font-family: "SF Mono", "Monaco", "Inconsolata", "Roboto Mono", monospace;
    font-size: 12px;
    word-break: break-all;
}

.called-address a {
    color: var(--color-text-primary, #212121);
    text-decoration: none;
}

.called-address a:hover {
    text-decoration: underline;
}

.address-label {
    color: var(--color-text-muted, #757575);
}

/* Array and Tuple containers */
.array-container,
.tuple-container {
    color: var(--color-text-muted, #757575);
    margin: 4px 0;
}

.array-item,
.tuple-item {
    padding-left: 16px;
    margin: 4px 0;
    border-left: 2px solid var(--color-border, #e0e0e0);
}

/* Nested array container */
.nested-array {
    display: flex;
    flex-direction: column;
}

.nested-array .array-item {
    padding-left: 16px;
}

/* Nested params-container in tuples should be indented */
.param-value > .params-container {
    padding-left: 16px;
    margin: 4px 0;
    border-left: 2px solid var(--color-border, #e0e0e0);
}

.empty-array,
.empty-tuple {
    color: var(--color-text-muted, #757575);
}

/* Bytes display */
.bytes-display {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    font-size: 14px;
}

.bytes-value {
    max-height: 200px;
    overflow: auto;
    display: inline-block;
    word-break: break-all;
}

/* uint256 */
.uint256-value {
    color: var(--color-text-primary, #212121);
    font-size: 14px;
}

.int-value {
    color: var(--color-text-primary, #212121);
}

.decimal-select {
    padding: 2px 4px;
    font-size: 12px;
    border: 1px solid var(--color-border, #e0e0e0);
    border-radius: 4px;
    background: var(--color-bg-secondary, #fff);
    margin-left: 4px;
}

.formatted-value {
    color: var(--color-primary, #1565c0);
    margin-left: 4px;
}

/* Bool and String */
.bool-value {
    color: var(--color-secondary, #6a1b9a);
}

.string-value {
    color: var(--color-success, #2e7d32);
}

.default-value {
    word-break: break-all;
}

/* Copy button */
.copy-btn {
    padding: 2px 6px;
    font-size: 11px;
    border: none;
    border-radius: 4px;
    background: var(--color-primary-soft, #e3f2fd);
    color: var(--color-primary, #1565c0);
    cursor: pointer;
    transition: all 0.2s;
}

.copy-btn:hover {
    background: var(--color-primary, #1565c0);
    color: white;
}

/* MultiSend transaction */
.multisend-tx {
    margin: 8px 0;
    padding: 8px;
    background: var(--color-bg-secondary, #fafafa);
    border-radius: 4px;
    border-left: 3px solid var(--color-primary, #1565c0);
}

.multisend-header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 4px;
}

.tx-index {
    font-weight: 600;
    color: var(--color-text-muted, #757575);
}

.function-name {
    font-family: "SF Mono", "Monaco", "Inconsolata", "Roboto Mono", monospace;
    font-weight: 600;
    color: var(--color-primary, #1565c0);
    word-break: break-all;
}

.operation-info {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
}

.operation-info.call {
    background: var(--color-success-soft, #e8f5e9);
    color: var(--color-success, #2e7d32);
}

.operation-info.delegatecall {
    background: var(--color-warning-soft, #fff3e0);
    color: var(--color-warning, #f57c00);
}

.call-value {
    padding: 8px;
    background: var(--color-bg-tertiary, #f5f5f5);
    border-radius: 4px;
    margin: 4px 0;
}

.raw-payload {
    font-family: "SF Mono", "Monaco", "Inconsolata", "Roboto Mono", monospace;
    font-size: 11px;
    max-height: 100px;
    overflow: auto;
    word-break: break-all;
    color: var(--color-text-muted, #757575);
    margin-top: 4px;
}

/* Decoded bytes */
.decoded-bytes {
    margin-top: 4px;
}

.decoded-bytes-header {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: "SF Mono", "Monaco", "Inconsolata", "Roboto Mono", monospace;
    font-weight: 600;
    color: var(--color-primary, #1565c0);
    margin-bottom: 4px;
}
</style>
