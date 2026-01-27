<template>
    <aside class="app-sidebar" :class="{ open: isOpen }">
        <div class="sidebar-header">
            <router-link to="/" class="sidebar-logo">
                <span class="sidebar-logo-icon">⟠</span>
                <span>ETH Dev Tools</span>
            </router-link>
        </div>

        <nav class="sidebar-nav">
            <div v-for="section in sections" :key="section.title" class="sidebar-section">
                <div class="sidebar-section-title" :class="{ collapsed: !expandedSections[section.title] }" @click="toggleSection(section.title)">
                    <span class="section-toggle-icon">{{ expandedSections[section.title] ? "▼" : "▶" }}</span>
                    <span>{{ section.title }}</span>
                </div>
                <Transition name="collapse">
                    <div v-show="expandedSections[section.title]" class="sidebar-section-content">
                        <router-link v-for="item in section.items" :key="item.path" :to="item.path" class="sidebar-link" active-class="active">
                            <span class="sidebar-link-icon">{{ item.icon }}</span>
                            <span>{{ item.label }}</span>
                        </router-link>
                    </div>
                </Transition>
            </div>
        </nav>

        <div class="sidebar-footer">
            <button class="btn btn-ghost btn-sm" @click="toggleTheme" style="width: 100%">
                <span>{{ isDark ? "☀️" : "🌙" }}</span>
                <span>{{ isDark ? "Light Mode" : "Dark Mode" }}</span>
            </button>
        </div>
    </aside>
</template>

<script setup>
import { ref, reactive, onMounted } from "vue";

defineProps({
    isOpen: {
        type: Boolean,
        default: false,
    },
});

const sections = [
    {
        title: "Contract Functions",
        items: [
            { path: "/payload", label: "Payload Parser", icon: "📦" },
            { path: "/vnet-reader", label: "Contract Reader", icon: "📖" },
            { path: "/signature", label: "Signature Extractor", icon: "✍️" },
        ],
        defaultExpanded: true,
    },
    {
        title: "Address Tools",
        items: [
            { path: "/checksum", label: "Address Checksum", icon: "✓" },
            { path: "/vanity", label: "Vanity Generator", icon: "✨" },
        ],
        defaultExpanded: false,
    },
    {
        title: "Explorer",
        items: [
            { path: "/explorers", label: "Block Explorers", icon: "🔍" },
            { path: "/protocols", label: "Protocol Links", icon: "🔗" },
        ],
        defaultExpanded: false,
    },
    {
        title: "Settings",
        items: [{ path: "/cache", label: "Cache Manager", icon: "📋" }],
        defaultExpanded: false,
    },
];

// Initialize expanded state from sections
const expandedSections = reactive(Object.fromEntries(sections.map((s) => [s.title, s.defaultExpanded])));

const toggleSection = (title) => {
    expandedSections[title] = !expandedSections[title];
    // Save to localStorage
    localStorage.setItem("eth-tools-sidebar-state", JSON.stringify(expandedSections));
};

const isDark = ref(false);

const toggleTheme = () => {
    isDark.value = !isDark.value;
    document.documentElement.setAttribute("data-theme", isDark.value ? "dark" : "light");
    localStorage.setItem("eth-tools-theme", isDark.value ? "dark" : "light");
};

onMounted(() => {
    // Load saved sidebar state
    const savedSidebarState = localStorage.getItem("eth-tools-sidebar-state");
    if (savedSidebarState) {
        try {
            const parsed = JSON.parse(savedSidebarState);
            Object.assign(expandedSections, parsed);
        } catch {}
    }

    // Load theme
    const savedTheme = localStorage.getItem("eth-tools-theme");
    if (savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
        isDark.value = true;
        document.documentElement.setAttribute("data-theme", "dark");
    }
});
</script>

<style scoped>
.sidebar-section-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-tertiary);
    cursor: pointer;
    user-select: none;
    transition: color var(--transition-fast);
}

.sidebar-section-title:hover {
    color: var(--color-text-secondary);
}

.section-toggle-icon {
    font-size: 8px;
    width: 12px;
    text-align: center;
    transition: transform var(--transition-fast);
}

.sidebar-section-content {
    overflow: hidden;
}

/* Collapse transition */
.collapse-enter-active,
.collapse-leave-active {
    transition: all var(--transition-normal);
    max-height: 200px;
}

.collapse-enter-from,
.collapse-leave-to {
    opacity: 0;
    max-height: 0;
}
</style>
