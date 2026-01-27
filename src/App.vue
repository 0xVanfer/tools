<template>
    <div class="app-layout">
        <AppSidebar :is-open="sidebarOpen" />

        <!-- Mobile Header -->
        <button class="mobile-menu-btn" @click="sidebarOpen = !sidebarOpen">☰</button>

        <main class="app-main">
            <div class="app-content">
                <router-view v-slot="{ Component }">
                    <transition name="fade" mode="out-in">
                        <component :is="Component" />
                    </transition>
                </router-view>
            </div>

            <footer class="app-footer">
                <p>
                    Built with ❤️ for Ethereum developers
                    <span class="divider">|</span>
                    <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
                </p>
            </footer>
        </main>

        <!-- Mobile Overlay -->
        <div v-if="sidebarOpen" class="mobile-overlay" @click="sidebarOpen = false"></div>
    </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { useRoute } from "vue-router";
import { AppSidebar } from "@/components";

const route = useRoute();
const sidebarOpen = ref(false);

// Close sidebar on route change (mobile)
watch(
    () => route.path,
    () => {
        sidebarOpen.value = false;
    },
);
</script>

<style>
/* Transition styles */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

/* Mobile menu button */
.mobile-menu-btn {
    display: none;
    position: fixed;
    top: var(--space-4);
    left: var(--space-4);
    z-index: 250;
    width: 40px;
    height: 40px;
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-md);
    font-size: var(--text-xl);
    cursor: pointer;
    align-items: center;
    justify-content: center;
}

.mobile-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 50;
}

@media (max-width: 1024px) {
    .mobile-menu-btn {
        display: flex;
    }

    .mobile-overlay {
        display: block;
    }
}

/* Footer */
.app-footer {
    padding: var(--space-6) var(--space-8);
    text-align: center;
    border-top: 1px solid var(--color-border-primary);
    color: var(--color-text-tertiary);
    font-size: var(--text-sm);
}

.app-footer .divider {
    margin: 0 var(--space-2);
    opacity: 0.5;
}

.app-footer a {
    color: var(--color-text-secondary);
}

.app-footer a:hover {
    color: var(--color-accent-primary);
}
</style>
