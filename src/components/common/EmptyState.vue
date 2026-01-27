<template>
    <div class="empty-state">
        <div v-if="icon" class="empty-state-icon">{{ icon }}</div>
        <h3 class="empty-state-title">{{ title }}</h3>
        <p v-if="description" class="empty-state-desc">{{ description }}</p>
        <slot></slot>
    </div>
</template>

<script setup>
defineProps({
    icon: {
        type: String,
        default: "📭",
    },
    title: {
        type: String,
        default: "No data",
    },
    description: {
        type: String,
        default: "",
    },
});
</script>
