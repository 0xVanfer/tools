<template>
    <div class="vanity-generator">
        <PageHeader title="Vanity Address Generator" description="Generate Ethereum addresses with custom prefixes or suffixes" />

        <div class="generator-container">
            <div class="card">
                <div class="card-body">
                    <div class="input-row">
                        <label class="label">Quantity</label>
                        <input v-model.number="quantity" type="number" class="input" min="1" max="100" :disabled="isRunning" />
                    </div>

                    <div class="input-row">
                        <label class="label">Prefix (0x...)</label>
                        <input v-model="prefix" type="text" class="input mono" placeholder="e.g. AA" :disabled="isRunning" @input="validateInput('prefix')" />
                    </div>

                    <div class="input-row">
                        <label class="label">Suffix</label>
                        <input v-model="suffix" type="text" class="input mono" placeholder="e.g. 88" :disabled="isRunning" @input="validateInput('suffix')" />
                    </div>

                    <div class="input-row">
                        <label class="label">Timeout (minutes)</label>
                        <input v-model.number="timeoutMins" type="number" class="input" min="1" max="60" :disabled="isRunning" />
                    </div>

                    <div class="actions">
                        <button v-if="!isRunning" class="btn btn-primary" @click="startGeneration" :disabled="!canStart">Start Generating</button>
                        <button v-else class="btn btn-danger" @click="stopGeneration">Stop</button>
                    </div>
                </div>
            </div>

            <!-- Results -->
            <div v-if="results.length > 0" class="results mt-6">
                <div class="results-header">
                    <h3 class="results-title">Found Addresses ({{ results.length }})</h3>
                    <button class="btn btn-sm btn-secondary" @click="clearResults">Clear Results</button>
                </div>

                <div class="results-list mt-4">
                    <div v-for="(result, idx) in results" :key="idx" class="result-item">
                        <div class="result-row">
                            <span class="result-label">Address:</span>
                            <span class="result-value">{{ result.address }}</span>
                            <CopyButton :text="result.address" />
                        </div>
                        <div class="result-row">
                            <span class="result-label">Private Key:</span>
                            <span class="result-value">{{ result.privateKey }}</span>
                            <CopyButton :text="result.privateKey" />
                        </div>
                    </div>
                </div>
            </div>

            <!-- Warning Card -->
            <div class="warning-card mt-6">
                <h4>⚠️ Security Warning</h4>
                <ul>
                    <li>Private keys are generated locally in your browser</li>
                    <li>Never share your private key with anyone</li>
                    <li>Store private keys in a secure location immediately</li>
                    <li>This tool uses Web Workers for performance - no data leaves your browser</li>
                </ul>
            </div>
        </div>

        <!-- Scanned Count (Fixed bottom right) -->
        <div class="scanned-count">Scanned: {{ formatNumber(scannedCount) }}</div>
    </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from "vue";
import { PageHeader, CopyButton } from "@/components";

const quantity = ref(1);
const prefix = ref("");
const suffix = ref("");
const timeoutMins = ref(10);
const isRunning = ref(false);
const scannedCount = ref(0);
const results = ref([]);

let workers = [];
let foundCount = 0;
let timeoutId = null;

const HEX_REGEX = /^[0-9a-fA-F]*$/;

const validateInput = (field) => {
    const value = field === "prefix" ? prefix.value : suffix.value;
    const cleaned = value.replace(/[^0-9a-fA-F]/g, "");
    if (field === "prefix") {
        prefix.value = cleaned;
    } else {
        suffix.value = cleaned;
    }
};

const canStart = computed(() => {
    return (prefix.value.length > 0 || suffix.value.length > 0) && HEX_REGEX.test(prefix.value) && HEX_REGEX.test(suffix.value);
});

const formatNumber = (num) => {
    return num.toLocaleString();
};

// Worker code as string
const workerCode = `
importScripts('https://cdn.jsdelivr.net/npm/ethers@5.7.0/dist/ethers.umd.min.js');

self.onmessage = function(e) {
    const { prefix, suffix } = e.data;
    const prefixLower = prefix ? prefix.toLowerCase() : '';
    const suffixLower = suffix ? suffix.toLowerCase() : '';
    
    let count = 0;
    
    while (true) {
        // Optimization: Generate private key directly to avoid expensive mnemonic derivation
        const privateKey = ethers.utils.hexlify(ethers.utils.randomBytes(32));
        const wallet = new ethers.Wallet(privateKey);
        const address = wallet.address;
        const addressNoPrefix = address.substring(2).toLowerCase();
        
        let match = true;
        if (prefixLower && !addressNoPrefix.startsWith(prefixLower)) match = false;
        if (match && suffixLower && !addressNoPrefix.endsWith(suffixLower)) match = false;
        
        if (match) {
            self.postMessage({
                type: 'found',
                address: wallet.address,
                privateKey: wallet.privateKey
            });
        }
        
        count++;
        if (count >= 10000) {
            self.postMessage({ type: 'progress', count: count });
            count = 0;
        }
    }
};
`;

const startGeneration = () => {
    // Validation
    if (!HEX_REGEX.test(prefix.value) || !HEX_REGEX.test(suffix.value)) {
        alert("Prefix and Suffix must be valid HEX characters (0-9, A-F)");
        return;
    }

    isRunning.value = true;
    scannedCount.value = 0;
    foundCount = 0;

    // Start Workers
    const threadCount = navigator.hardwareConcurrency || 4;
    const blob = new Blob([workerCode], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);

    for (let i = 0; i < threadCount; i++) {
        const worker = new Worker(workerUrl);
        worker.onmessage = handleWorkerMessage;
        worker.postMessage({ prefix: prefix.value, suffix: suffix.value });
        workers.push(worker);
    }

    // Timeout handler
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(
        () => {
            if (isRunning.value) {
                alert("Timeout reached!");
                stopGeneration();
            }
        },
        timeoutMins.value * 60 * 1000,
    );
};

const handleWorkerMessage = (e) => {
    if (!isRunning.value) return;

    const data = e.data;
    if (data.type === "progress") {
        scannedCount.value += data.count;
    } else if (data.type === "found") {
        results.value.push({
            address: data.address,
            privateKey: data.privateKey,
        });
        foundCount++;
        if (foundCount >= quantity.value) {
            stopGeneration();
        }
    }
};

const stopGeneration = () => {
    if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
    }
    isRunning.value = false;
    workers.forEach((w) => w.terminate());
    workers = [];
};

const clearResults = () => {
    results.value = [];
};

onUnmounted(() => {
    stopGeneration();
});
</script>

<style scoped>
.generator-container {
    max-width: 700px;
}

.input-row {
    margin-bottom: var(--space-4);
}

.mono {
    font-family: var(--font-mono);
}

.actions {
    margin-top: var(--space-6);
}

.btn-danger {
    background-color: #dc3545;
    color: white;
}

.btn-danger:hover {
    background-color: #c82333;
}

.results-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.results-title {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
}

.results-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
}

.result-item {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    font-family: var(--font-mono);
}

.result-row {
    display: flex;
    align-items: center;
    margin: var(--space-2) 0;
    gap: var(--space-2);
}

.result-label {
    width: 100px;
    color: var(--color-text-tertiary);
    flex-shrink: 0;
}

.result-value {
    word-break: break-all;
    font-size: var(--text-sm);
    flex: 1;
}

.warning-card {
    background: rgb(245 158 11 / 0.1);
    border: 1px solid rgb(245 158 11 / 0.3);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
}

.warning-card h4 {
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    margin-bottom: var(--space-3);
    color: var(--color-accent-warning);
}

.warning-card ul {
    padding-left: var(--space-4);
    list-style: disc;
}

.warning-card li {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    margin-bottom: var(--space-1);
}

.scanned-count {
    position: fixed;
    bottom: 10px;
    right: 20px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 5px 10px;
    border-radius: 4px;
    font-family: var(--font-mono);
    z-index: 100;
}
</style>
