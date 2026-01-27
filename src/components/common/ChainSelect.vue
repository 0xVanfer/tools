<template>
    <div class="chain-select-wrapper">
        <label v-if="label" class="label">{{ label }}</label>
        <select class="input select chain-select" :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
            <option v-for="chain in chains" :key="chain.id" :value="chain.id">
                {{ chain.name }}
            </option>
        </select>
    </div>
</template>

<script setup>
import { CHAINS } from "@/utils/chains";

defineProps({
    modelValue: {
        type: String,
        default: "mainnet",
    },
    label: {
        type: String,
        default: "",
    },
});

defineEmits(["update:modelValue"]);

const chains = Object.values(CHAINS);
</script>

<style scoped>
.chain-select-wrapper {
    width: 100%;
}

.chain-select {
    width: 100%;
}
</style>
