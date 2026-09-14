<template>
    <button
        class="copy-btn"
        :class="{ copied: isCopied, 'btn-text-only': showText, 'btn-icon': !showText }"
        @click="handleCopy"
        :disabled="!text"
        :title="isCopied ? 'Copied!' : 'Copy to clipboard'"
    >
        <span v-if="showText" class="copy-text">{{ isCopied ? "copied" : "copy" }}</span>
        <span v-else class="copy-icon">{{ isCopied ? "✓" : "📋" }}</span>
    </button>
</template>

<script setup>
import { useClipboard } from "@/composables";

const props = defineProps({
    text: {
        type: String,
        default: "",
    },
    label: {
        type: String,
        default: "Copy",
    },
    showText: {
        type: Boolean,
        default: false,
    },
});

const emit = defineEmits(["copied"]);

const { copy, copied: isCopied } = useClipboard();

const handleCopy = async () => {
    if (props.text) {
        const success = await copy(props.text);
        if (success) {
            emit("copied");
        }
    }
};
</script>

<style scoped>
.copy-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all var(--transition-fast);
}

.copy-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

/* Text-only button style */
.copy-btn.btn-text-only {
    padding: 0.1rem 0.3rem;
}

.copy-btn.btn-text-only .copy-text {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-success);
}

.copy-btn.btn-text-only:hover:not(:disabled) .copy-text {
    text-decoration: underline;
}

.copy-btn.btn-text-only.copied .copy-text {
    color: var(--color-primary);
}

/* Icon button style */
.copy-btn.btn-icon {
    padding: var(--space-1);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
}

.copy-btn.btn-icon:hover:not(:disabled) {
    background: var(--color-bg-hover);
    border-color: var(--color-border-secondary);
}

.copy-btn.btn-icon.copied {
    background: rgb(16 185 129 / 0.1);
    border-color: var(--color-accent-success);
    color: var(--color-accent-success);
}

.copy-icon {
    font-size: 14px;
}
</style>
