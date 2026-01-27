<template>
    <div class="result-value-display">
        <!-- Multiple return values (tuple) -->
        <div v-if="isTupleResult" class="value-tuple">
            <div v-for="(item, index) in tupleItems" :key="index" class="tuple-item">
                <span class="tuple-label">{{ getTupleLabel(index) }}:</span>
                <ResultValueDisplay
                    :value="item.value"
                    :output-types="[item.type]"
                    :chain-id="chainId"
                    :decimals-map="decimalsMap"
                    :item-index="index"
                    :compare-value="getCompareItemValue(index)"
                    @update:decimals="(idx, val) => $emit('update:decimals', idx, val)"
                />
            </div>
        </div>

        <!-- Array values -->
        <div v-else-if="isArray" class="value-array">
            <div v-for="(item, index) in normalizedValue" :key="index" class="array-item">
                <span class="array-index">[{{ index }}]</span>
                <ResultValueDisplay
                    :value="item"
                    :output-types="[getArrayElementType()]"
                    :chain-id="chainId"
                    :decimals-map="decimalsMap"
                    :item-index="itemIndex"
                    @update:decimals="(idx, val) => $emit('update:decimals', idx, val)"
                />
            </div>
        </div>

        <!-- Address value -->
        <div v-else-if="isAddress" class="value-address">
            <a :href="explorerLink" target="_blank" class="address-link" :title="stringValue">
                {{ formattedAddress }}
            </a>
            <span v-if="displayName" class="address-name">({{ displayName }})</span>
            <CopyButton :text="stringValue" show-text />
        </div>

        <!-- Numeric value (uint/int) -->
        <div v-else-if="isNumeric" class="value-numeric">
            <span class="numeric-value">{{ formattedNumeric }}</span>
            <span v-if="valueDifference && !valueDifference.isZero" class="value-diff" :class="valueDifference.isPositive ? 'diff-positive' : 'diff-negative'">
                {{ valueDifference.isPositive ? "+" : "-" }}{{ valueDifference.diff }}
            </span>
            <select v-model="localDecimals" class="decimals-select" title="Display decimals" @change="onDecimalsChange">
                <option :value="0">Raw</option>
                <option :value="6">÷10⁶</option>
                <option :value="8">÷10⁸</option>
                <option :value="18">÷10¹⁸</option>
            </select>
            <CopyButton :text="rawStringValue" show-text />
        </div>

        <!-- Boolean value -->
        <div v-else-if="isBoolean" class="value-boolean">
            <span :class="booleanValue ? 'bool-true' : 'bool-false'">{{ booleanValue ? "true" : "false" }}</span>
        </div>

        <!-- Bytes value -->
        <div v-else-if="isBytes" class="value-bytes">
            <code class="bytes-value" :title="stringValue">{{ truncatedBytes }}</code>
            <CopyButton :text="stringValue" show-text />
        </div>

        <!-- String value -->
        <div v-else-if="isString" class="value-string">
            <span class="string-value">"{{ stringValue }}"</span>
            <CopyButton :text="stringValue" show-text />
        </div>

        <!-- Fallback -->
        <div v-else class="value-raw">
            <code class="raw-value">{{ stringValue }}</code>
            <CopyButton :text="stringValue" show-text />
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import CopyButton from "@/components/common/CopyButton.vue";
import { getExplorerUrl } from "@/utils/chains";
import { getAddressDisplayName } from "@/utils/cacheManager";
import { formatValue, formatWithDecimals } from "@/utils/multicall";
import { isValidAddress, formatAddress } from "@/utils/ethereum";

const props = defineProps({
    value: {
        type: [String, Number, Boolean, Array, Object],
        default: null,
    },
    outputTypes: {
        type: Array,
        default: () => [],
    },
    chainId: {
        type: String,
        default: "1",
    },
    decimalsMap: {
        type: Object,
        default: () => ({}),
    },
    itemIndex: {
        type: Number,
        default: 0,
    },
    compareValue: {
        type: [String, Number, Boolean, Array, Object],
        default: null,
    },
});

const emit = defineEmits(["update:decimals"]);

// Local decimals - synced with decimalsMap[itemIndex]
const localDecimals = ref(props.decimalsMap[props.itemIndex] || 0);

watch(
    () => props.decimalsMap[props.itemIndex],
    (newVal) => {
        localDecimals.value = newVal || 0;
    },
);

function onDecimalsChange() {
    emit("update:decimals", props.itemIndex, localDecimals.value);
}

// Get compare value for tuple item
function getCompareItemValue(index) {
    if (!props.compareValue) return null;
    if (Array.isArray(props.compareValue)) {
        return props.compareValue[index];
    }
    if (typeof props.compareValue === "object" && props.compareValue !== null) {
        return props.compareValue[index];
    }
    return null;
}

// Determine the primary type
const primaryType = computed(() => {
    if (props.outputTypes.length > 0) {
        return props.outputTypes[0];
    }
    return "";
});

// Check if this is a tuple result (multiple return values)
const isTupleResult = computed(() => {
    // Multiple output types means it's a function returning multiple values
    if (props.outputTypes.length > 1) {
        // ethers.js returns Result objects which are array-like but also have named properties
        // Check if value is array-like and has correct length
        if (props.value && typeof props.value === "object") {
            // Handle ethers Result object or plain array
            let valueLength = 0;
            if (Array.isArray(props.value)) {
                valueLength = props.value.length;
            } else if (typeof props.value.length === "number") {
                valueLength = props.value.length;
            } else {
                // Try to count properties
                valueLength = Object.keys(props.value).filter((k) => !isNaN(parseInt(k))).length;
            }

            console.log("[ResultValueDisplay] isTupleResult check:", {
                outputTypesLength: props.outputTypes.length,
                valueLength,
                valueType: typeof props.value,
                isArray: Array.isArray(props.value),
                value: props.value,
            });

            return valueLength === props.outputTypes.length;
        }
        return false;
    }
    // Single tuple type like "(uint256,address)"
    const type = primaryType.value;
    if (type && type.startsWith("(") && type.endsWith(")") && !type.endsWith("[]")) {
        return Array.isArray(props.value) || (props.value && typeof props.value === "object" && props.value.length !== undefined);
    }
    return false;
});

// Get tuple items with their types
const tupleItems = computed(() => {
    if (!isTupleResult.value) return [];

    // Convert value to array (handles ethers Result objects)
    let valueArray;
    if (Array.isArray(props.value)) {
        valueArray = props.value;
    } else if (props.value && typeof props.value === "object") {
        // Handle ethers Result object - iterate by numeric indices
        valueArray = [];
        const length = typeof props.value.length === "number" ? props.value.length : props.outputTypes.length;
        for (let i = 0; i < length; i++) {
            valueArray.push(props.value[i]);
        }
    } else {
        valueArray = [props.value];
    }

    console.log("[ResultValueDisplay] tupleItems:", {
        valueArray,
        outputTypes: props.outputTypes,
    });

    // Multiple output types
    if (props.outputTypes.length > 1) {
        return valueArray.map((val, i) => ({
            value: val,
            type: props.outputTypes[i] || "unknown",
        }));
    }

    // Single tuple type - parse the tuple types
    const type = primaryType.value;
    const innerTypes = parseTupleTypes(type);
    return valueArray.map((val, i) => ({
        value: val,
        type: innerTypes[i] || "unknown",
    }));
});

// Parse tuple type string "(uint256,address,bool)" into ["uint256", "address", "bool"]
function parseTupleTypes(tupleType) {
    if (!tupleType.startsWith("(") || !tupleType.endsWith(")")) return [];
    const inner = tupleType.slice(1, -1);
    const types = [];
    let depth = 0;
    let current = "";
    for (const char of inner) {
        if (char === "(") depth++;
        if (char === ")") depth--;
        if (char === "," && depth === 0) {
            types.push(current.trim());
            current = "";
        } else {
            current += char;
        }
    }
    if (current.trim()) types.push(current.trim());
    return types;
}

function getTupleLabel(index) {
    // Try to get output names if available from parent context
    return `[${index}]`;
}

// Type checks
const isArray = computed(() => {
    if (!Array.isArray(props.value)) return false;
    if (isTupleResult.value) return false;
    const type = primaryType.value;
    return type.endsWith("[]");
});

const isAddress = computed(() => {
    if (primaryType.value === "address") return true;
    if (typeof props.value === "string" && isValidAddress(props.value)) return true;
    return false;
});

const isNumeric = computed(() => {
    const type = primaryType.value;
    return type.startsWith("uint") || type.startsWith("int");
});

const isBoolean = computed(() => {
    return primaryType.value === "bool" || typeof props.value === "boolean";
});

const isBytes = computed(() => {
    const type = primaryType.value;
    return type.startsWith("bytes");
});

const isString = computed(() => {
    return primaryType.value === "string";
});

// Normalized value handling
const normalizedValue = computed(() => {
    if (props.value === null || props.value === undefined) return [];
    if (Array.isArray(props.value)) return props.value;
    return [props.value];
});

const stringValue = computed(() => {
    if (props.value === null || props.value === undefined) return "null";
    return formatValue(props.value);
});

// Raw string value for copy (without formatting)
const rawStringValue = computed(() => {
    if (props.value === null || props.value === undefined) return "null";
    if (typeof props.value === "bigint") return props.value.toString();
    if (typeof props.value === "object" && props.value._isBigNumber) {
        return props.value.toString();
    }
    return String(props.value);
});

const booleanValue = computed(() => {
    if (typeof props.value === "boolean") return props.value;
    return String(props.value).toLowerCase() === "true";
});

// Address display
const explorerLink = computed(() => {
    if (!isAddress.value || !props.chainId) return "#";
    const baseUrl = getExplorerUrl(props.chainId);
    return baseUrl ? `${baseUrl}/address/${stringValue.value}` : "#";
});

const formattedAddress = computed(() => {
    if (!isAddress.value) return stringValue.value;
    return formatAddress(stringValue.value, 6, 4);
});

const displayName = computed(() => {
    if (!isAddress.value) return null;
    return getAddressDisplayName(stringValue.value, props.chainId);
});

// Numeric display
const formattedNumeric = computed(() => {
    if (!isNumeric.value) return stringValue.value;
    if (localDecimals.value === 0) {
        return stringValue.value;
    }
    return formatWithDecimals(props.value, localDecimals.value);
});

// Calculate difference between value and compareValue for numeric types
const valueDifference = computed(() => {
    if (!isNumeric.value || props.compareValue === null || props.compareValue === undefined) {
        return null;
    }

    try {
        const currentValue = BigInt(String(props.value));
        const compareValue = BigInt(String(props.compareValue));

        if (currentValue === compareValue) {
            return { diff: "0", isPositive: false, isZero: true };
        }

        const diff = currentValue - compareValue;
        const isPositive = diff > 0n;
        const absDiff = isPositive ? diff : -diff;

        // Format with decimals if needed
        let formattedDiff;
        if (localDecimals.value === 0) {
            formattedDiff = absDiff.toString();
        } else {
            formattedDiff = formatWithDecimals(absDiff.toString(), localDecimals.value);
        }

        return {
            diff: formattedDiff,
            isPositive,
            isZero: false,
        };
    } catch {
        return null;
    }
});

// Bytes display
const truncatedBytes = computed(() => {
    const str = stringValue.value;
    if (str.length > 20) {
        return str.slice(0, 10) + "..." + str.slice(-8);
    }
    return str;
});

// Get element type for arrays
function getArrayElementType() {
    const type = primaryType.value;
    if (type.endsWith("[]")) {
        return type.slice(0, -2);
    }
    return type;
}
</script>

<style scoped>
.result-value-display {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
    font-size: 0.9rem;
}

/* Tuple display */
.value-tuple {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem;
    background: var(--color-surface-hover);
    border-radius: 6px;
    border-left: 3px solid var(--color-primary);
}

.tuple-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
}

.tuple-label {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    color: var(--color-muted);
    min-width: 40px;
    font-weight: 500;
}

.value-array {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    width: 100%;
}

.array-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-left: 1rem;
}

.array-index {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    color: var(--color-muted);
    min-width: 35px;
}

.value-address {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
}

.address-link {
    font-family: var(--font-mono);
    font-size: 0.9rem;
    color: var(--color-primary);
    text-decoration: none;
    font-weight: 500;
}

.address-link:hover {
    text-decoration: underline;
}

.address-name {
    font-size: 0.9rem;
    color: var(--color-muted);
    font-style: italic;
}

.value-numeric {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.numeric-value {
    font-family: var(--font-mono);
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--color-text);
}

.value-diff {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    font-weight: 600;
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
}

.value-diff.diff-positive {
    color: var(--color-success);
    background: rgba(16, 185, 129, 0.15);
}

.value-diff.diff-negative {
    color: var(--color-error);
    background: rgba(239, 68, 68, 0.15);
}

.decimals-select {
    font-size: 0.7rem;
    padding: 0.1rem 0.3rem;
    border-radius: 4px;
    background: var(--color-surface-hover);
    border: 1px solid var(--color-border);
    cursor: pointer;
}

.value-boolean {
    display: inline-flex;
    align-items: center;
}

.bool-true {
    color: var(--color-success);
    font-weight: 500;
    font-size: 0.9rem;
}

.bool-false {
    color: var(--color-error);
    font-weight: 500;
    font-size: 0.9rem;
}

.value-bytes {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
}

.bytes-value {
    font-family: var(--font-mono);
    font-size: 0.9rem;
    background: var(--color-surface-hover);
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
}

.value-string {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
}

.string-value {
    color: var(--color-success);
    font-size: 0.9rem;
    font-weight: 500;
}

.value-raw {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
}

.raw-value {
    font-family: var(--font-mono);
    font-size: 0.9rem;
    word-break: break-all;
}
</style>
