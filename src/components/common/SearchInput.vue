<template>
    <div class="search-input-wrapper input-group">
        <span class="input-group-icon">🔍</span>
        <input
            type="text"
            class="input search-input"
            :value="modelValue"
            :placeholder="placeholder"
            @input="$emit('update:modelValue', $event.target.value)"
            @keyup.enter="$emit('search')"
        />
        <button v-if="modelValue" class="search-clear" @click="$emit('update:modelValue', '')" title="Clear">✕</button>
    </div>
</template>

<script setup>
defineProps({
    modelValue: {
        type: String,
        default: "",
    },
    placeholder: {
        type: String,
        default: "Search...",
    },
});

defineEmits(["update:modelValue", "search"]);
</script>

<style scoped>
.search-input-wrapper {
    position: relative;
    width: 100%;
}

.search-input {
    padding-left: var(--space-10);
    padding-right: var(--space-10);
}

.search-clear {
    position: absolute;
    right: var(--space-3);
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--color-text-tertiary);
    cursor: pointer;
    padding: var(--space-1);
    font-size: var(--text-sm);
    line-height: 1;
    transition: color var(--transition-fast);
}

.search-clear:hover {
    color: var(--color-text-primary);
}
</style>
