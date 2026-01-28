<template>
    <div class="safe-tx">
        <div class="tx-header">
            <span class="tx-idx">#{{ index + 1 }}</span>
            <span class="op-badge" :class="transaction.operation === 1 ? 'delegatecall' : 'call'">
                {{ transaction.operation === 1 ? "delegatecall" : "call" }}
            </span>
            <span v-if="transaction.decoded?.signature" class="fn-name">{{ transaction.decoded.signature }}</span>
            <span v-else-if="transaction.decoded?.selector" class="fn-selector">{{ transaction.decoded.selector }}</span>
            <span v-if="transaction.value && transaction.value !== '0'" class="tx-val">{{ formatEth(transaction.value) }}</span>
        </div>
        <div class="tx-addr">
            To: <a :href="explorerUrl(transaction.address)" target="_blank" rel="noopener">{{ checksumAddr(transaction.address) }}</a>
            <span v-if="addrName(transaction.address)" class="addr-name">{{ addrName(transaction.address) }}</span>
        </div>
        <ParameterList v-if="transaction.decoded?.params?.length" :params="transaction.decoded.params" :chain-id="chainId" :depth="1" />
        <div v-if="transaction.decoded?.calls?.length" class="nested">
            <MulticallCard v-for="(c, i) in transaction.decoded.calls" :key="i" :call="c" :index="i" :chain-id="chainId" />
        </div>
        <div v-if="transaction.decoded?.transactions?.length" class="nested">
            <SafeTransactionCard v-for="(t, i) in transaction.decoded.transactions" :key="i" :transaction="t" :index="i" :chain-id="chainId" />
        </div>
        <code v-if="!transaction.decoded && transaction.data" class="raw">{{ truncate(transaction.data) }}</code>
    </div>
</template>

<script setup>
import { useAddressDisplay } from "@/composables";
import ParameterList from "./ParameterList.vue";
import MulticallCard from "./MulticallCard.vue";

const props = defineProps({
    transaction: { type: Object, required: true },
    index: { type: Number, required: true },
    chainId: { type: String, default: "1" },
});

// Use shared address display utilities - THE SINGLE SOURCE OF TRUTH
const { getName: addrName, getExplorerUrl: explorerUrl, checksum: checksumAddr } = useAddressDisplay(() => props.chainId);
const formatEth = (v) => {
    try {
        const e = Number(BigInt(v)) / 1e18;
        return e >= 0.001 ? `${e.toFixed(4)} ETH` : `${v} wei`;
    } catch {
        return v;
    }
};
const truncate = (h) => (h?.length > 66 ? `${h.slice(0, 34)}...${h.slice(-32)}` : h);
</script>

<style scoped>
.safe-tx {
    padding: 8px;
    margin-bottom: 6px;
    background: var(--color-bg-secondary);
    border-radius: 4px;
    border-left: 3px solid var(--color-warning);
}
.tx-header {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 12px;
    margin-bottom: 4px;
}
.tx-idx {
    font-weight: 600;
    color: var(--color-text-secondary);
}
.op-badge {
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 500;
}
.op-badge.call {
    background: var(--color-success-soft);
    color: var(--color-success);
}
.op-badge.delegatecall {
    background: var(--color-error-soft);
    color: var(--color-error);
}
.fn-name {
    font-family: var(--font-mono);
    color: var(--color-primary);
    font-weight: 600;
}
.fn-selector {
    font-family: var(--font-mono);
    color: var(--color-text-muted);
}
.tx-val {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-warning);
}
.tx-addr {
    font-size: 11px;
    margin-bottom: 6px;
}
.tx-addr a {
    font-family: var(--font-mono);
    color: var(--color-text-primary);
    text-decoration: none;
}
.tx-addr a:hover {
    text-decoration: underline;
}
.addr-name {
    color: var(--color-primary);
    font-weight: 500;
    margin-left: 4px;
}
.nested {
    margin-top: 6px;
    margin-left: 8px;
    padding-left: 8px;
    border-left: 2px solid var(--color-border);
}
.raw {
    display: block;
    font-size: 10px;
    color: var(--color-text-muted);
    word-break: break-all;
    margin-top: 4px;
}
</style>
