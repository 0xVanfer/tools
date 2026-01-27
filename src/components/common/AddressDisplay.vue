<template>
    <div class="address-display" :class="{ 'address-full': full }" :data-address="address.toLowerCase()">
        <span v-if="displayLabel" class="address-label" :title="displayLabel">{{ displayLabel }}</span>
        <span class="address-text" :title="address">
            {{ displayAddress }}
        </span>
        <CopyButton :text="address" />
        <a v-if="chainId && explorerUrl" :href="explorerUrl" target="_blank" rel="noopener noreferrer" class="address-explorer" title="View on explorer">
            🔗
        </a>
    </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import CopyButton from "./CopyButton.vue";
import { getExplorerUrl, shortenAddress } from "@/utils/chains";
import { getAddressDisplayName } from "@/utils/cacheManager";

const props = defineProps({
    address: {
        type: String,
        required: true,
    },
    chainId: {
        type: String,
        default: "1",
    },
    full: {
        type: Boolean,
        default: false,
    },
    label: {
        type: String,
        default: "",
    },
});

// Cached display name from cacheManager (5-level priority)
const cachedDisplayName = ref("");

// Fetch display name from cache on mount and when address/chainId changes
const updateCachedDisplayName = () => {
    const name = getAddressDisplayName(props.address, props.chainId);
    cachedDisplayName.value = name || "";
};

onMounted(updateCachedDisplayName);
watch(() => [props.address, props.chainId], updateCachedDisplayName);

// Display label: priority is prop.label > cached display name
const displayLabel = computed(() => {
    if (props.label) return props.label;
    return cachedDisplayName.value;
});

const displayAddress = computed(() => {
    if (props.full) return props.address;
    return shortenAddress(props.address);
});

const explorerUrl = computed(() => {
    if (!props.chainId || !props.address) return "";
    return getExplorerUrl(props.chainId, props.address, "address");
});
</script>

<style scoped>
.address-display {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    background: var(--color-bg-tertiary);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 11px;
}

.address-label {
    color: var(--color-primary);
    font-weight: var(--font-semibold);
    font-family: var(--font-sans);
    font-size: 11px;
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.address-text {
    color: var(--color-text-primary);
}

.address-full .address-text {
    word-break: break-all;
}

.address-explorer {
    display: flex;
    align-items: center;
    font-size: 10px;
    color: var(--color-text-tertiary);
    transition: color var(--transition-fast);
}

.address-explorer:hover {
    color: var(--color-accent-primary);
}
</style>
