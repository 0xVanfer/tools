<template>
    <div class="multicall-item">
        <div class="call-header">
            <span class="call-idx">#{{ index + 1 }}</span>
            <span v-if="call.decoded?.signature" class="fn-name">{{ call.decoded.signature }}</span>
            <span v-else-if="call.decoded?.selector" class="fn-selector">{{ call.decoded.selector }}</span>
            <span v-else class="fn-unknown">Unknown</span>
        </div>
        <div v-if="call.target" class="call-target">
            Target: <a :href="explorerUrl(call.target)" target="_blank" rel="noopener">{{ checksumAddr(call.target) }}</a>
            <span v-if="addrName(call.target)" class="addr-name">{{ addrName(call.target) }}</span>
        </div>
        <ParameterList v-if="call.decoded?.params?.length" :params="call.decoded.params" :chain-id="chainId" :depth="1" />
        <div v-if="call.decoded?.calls?.length" class="nested">
            <MulticallCard v-for="(c, i) in call.decoded.calls" :key="i" :call="c" :index="i" :chain-id="chainId" />
        </div>
        <div v-if="call.decoded?.transactions?.length" class="nested">
            <SafeTransactionCard v-for="(t, i) in call.decoded.transactions" :key="i" :transaction="t" :index="i" :chain-id="chainId" />
        </div>
        <code v-if="!call.decoded && call.data" class="raw">{{ truncate(call.data) }}</code>
    </div>
</template>

<script setup>
import { getExplorerUrl } from "@/utils/chains";
import { toChecksumAddress } from "@/utils/ethereum";
import { getAddressDisplayName } from "@/utils/cacheManager";
import ParameterList from "./ParameterList.vue";
import SafeTransactionCard from "./SafeTransactionCard.vue";

const props = defineProps({
    call: { type: Object, required: true },
    index: { type: Number, required: true },
    chainId: { type: String, default: "1" },
});

const checksumAddr = (a) => {
    try {
        return toChecksumAddress(a);
    } catch {
        return a;
    }
};
const explorerUrl = (a) => getExplorerUrl(props.chainId, a, "address") || `https://etherscan.io/address/${a}`;
const addrName = (a) => getAddressDisplayName(a, props.chainId) || "";
const truncate = (h) => (h?.length > 66 ? `${h.slice(0, 34)}...${h.slice(-32)}` : h);
</script>

<style scoped>
.multicall-item {
    padding: 8px;
    margin-bottom: 6px;
    background: var(--color-bg-secondary);
    border-radius: 4px;
    border-left: 3px solid var(--color-info);
}
.call-header {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 12px;
    margin-bottom: 4px;
}
.call-idx {
    font-weight: 600;
    color: var(--color-text-secondary);
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
.fn-unknown {
    color: var(--color-text-muted);
}
.call-target {
    font-size: 11px;
    margin-bottom: 6px;
}
.call-target a {
    font-family: var(--font-mono);
    color: var(--color-text-primary);
    text-decoration: none;
}
.call-target a:hover {
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
