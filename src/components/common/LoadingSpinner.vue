<template>
    <div class="loading" :class="[`loading-${size}`, { 'loading-overlay': overlay }]">
        <div class="spinner" :class="`spinner-${size}`"></div>
        <span v-if="text" class="loading-text">{{ text }}</span>
    </div>
</template>

<script setup>
defineProps({
    size: {
        type: String,
        default: "md",
        validator: (v) => ["sm", "md", "lg"].includes(v),
    },
    text: {
        type: String,
        default: "",
    },
    overlay: {
        type: Boolean,
        default: false,
    },
});
</script>

<style scoped>
.loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
}

.loading-overlay {
    position: absolute;
    inset: 0;
    background: rgb(255 255 255 / 0.8);
    backdrop-filter: blur(2px);
    z-index: 10;
}

[data-theme="dark"] .loading-overlay {
    background: rgb(15 23 42 / 0.8);
}

.spinner {
    border: 2px solid var(--color-border-primary);
    border-top-color: var(--color-accent-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

.spinner-sm {
    width: 16px;
    height: 16px;
}

.spinner-md {
    width: 24px;
    height: 24px;
}

.spinner-lg {
    width: 40px;
    height: 40px;
    border-width: 3px;
}

.loading-text {
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
