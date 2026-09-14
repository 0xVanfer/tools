<template>
    <div class="chain-select-wrapper">
        <label v-if="label" class="label">{{ label }}</label>
        <div class="chain-combobox" ref="inputWrapper">
            <input
                v-model="searchInput"
                type="text"
                class="input chain-combobox-input"
                :placeholder="placeholder"
                @focus="openDropdown"
                @blur="closeDropdownDelayed"
                @keydown.enter.prevent="selectFirstMatch"
            />
        </div>
        <Teleport to="body">
            <div v-if="showDropdown && filteredChains.length" class="chain-dropdown-portal" :style="dropdownStyle">
                <div
                    v-for="chain in filteredChains"
                    :key="chain.id"
                    class="chain-option"
                    :class="{ active: isSelected(chain) }"
                    @mousedown.prevent="selectChain(chain)"
                >
                    {{ formatChainLabel(chain) }}
                </div>
            </div>
        </Teleport>
    </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from "vue";
import { CHAINS } from "@/utils/chains";

const props = defineProps({
    modelValue: {
        type: [String, Number],
        default: 1,
    },
    label: {
        type: String,
        default: "",
    },
    placeholder: {
        type: String,
        default: "Search chain ID or name...",
    },
});

const emit = defineEmits(["update:modelValue"]);

const searchInput = ref("");
const debouncedSearch = ref("");
const showDropdown = ref(false);
const isFocused = ref(false);
const inputWrapper = ref(null);
const dropdownStyle = ref({});
let debounceTimer = null;
let blurTimer = null;

const chains = computed(() =>
    Object.values(CHAINS)
        .map((chain) => ({ ...chain, id: Number(chain.id) }))
        .sort((a, b) => a.id - b.id),
);

const normalize = (value) => value.toString().toLowerCase().replace(/\s+/g, "");

const matchesSearch = (chain, query) => {
    if (!query) return true;
    const haystack = normalize(`${chain.id} ${chain.name} ${chain.shortName || ""} ${chain.internalName || ""}`);
    return haystack.includes(query);
};

const filteredChains = computed(() => {
    const query = normalize(debouncedSearch.value.trim());
    return chains.value.filter((chain) => matchesSearch(chain, query));
});

const selectedChain = computed(() => chains.value.find((chain) => String(chain.id) === String(props.modelValue)));

const formatChainLabel = (chain) => `${chain.id} ${chain.name}`;

const isSelected = (chain) => String(chain.id) === String(props.modelValue);

const updateDropdownPosition = () => {
    if (!inputWrapper.value) return;
    const rect = inputWrapper.value.getBoundingClientRect();
    dropdownStyle.value = {
        position: "fixed",
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
    };
};

const openDropdown = () => {
    isFocused.value = true;
    updateDropdownPosition();
    showDropdown.value = true;
    window.addEventListener("scroll", updateDropdownPosition, true);
    window.addEventListener("resize", updateDropdownPosition);
};

const closeDropdownDelayed = () => {
    if (blurTimer) {
        clearTimeout(blurTimer);
    }
    blurTimer = setTimeout(() => {
        isFocused.value = false;
        showDropdown.value = false;
        if (selectedChain.value) {
            searchInput.value = formatChainLabel(selectedChain.value);
            debouncedSearch.value = "";
        }
        window.removeEventListener("scroll", updateDropdownPosition, true);
        window.removeEventListener("resize", updateDropdownPosition);
    }, 120);
};

const selectChain = (chain) => {
    emit("update:modelValue", Number(chain.id));
    searchInput.value = formatChainLabel(chain);
    debouncedSearch.value = "";
    showDropdown.value = false;
    window.removeEventListener("scroll", updateDropdownPosition, true);
    window.removeEventListener("resize", updateDropdownPosition);
};

const selectFirstMatch = () => {
    if (filteredChains.value.length > 0) {
        selectChain(filteredChains.value[0]);
    }
};

watch(searchInput, (value) => {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
        debouncedSearch.value = value;
        if (showDropdown.value) {
            updateDropdownPosition();
        }
    }, 500);
});

watch(
    selectedChain,
    (chain) => {
        if (chain && !isFocused.value) {
            searchInput.value = formatChainLabel(chain);
        }
    },
    { immediate: true },
);

// Clean up listeners/timers when navigating away with the dropdown still open —
// previously the scroll/resize listeners leaked permanently.
onUnmounted(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (blurTimer) clearTimeout(blurTimer);
    window.removeEventListener("scroll", updateDropdownPosition, true);
    window.removeEventListener("resize", updateDropdownPosition);
});
</script>

<style scoped>
.chain-select-wrapper {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.chain-combobox {
    position: relative;
    width: 100%;
}

.chain-combobox-input {
    width: 100%;
}

.chain-dropdown-portal {
    z-index: 99999;
    max-height: 240px;
    overflow-y: auto;
    background-color: var(--color-bg-primary) !important;
    opacity: 1 !important;
    border: 2px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}

.chain-option {
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
    font-size: var(--text-sm);
}

.chain-option:hover {
    background: var(--color-bg-hover);
}

.chain-option.active {
    background: var(--color-primary-soft);
    color: var(--color-primary);
}
</style>
