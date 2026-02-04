<template>
    <div class="signature-extractor">
        <PageHeader
            title="Signature Extractor"
            description="Extract Solidity function and error signatures from GitHub/GitLab (including self-hosted) repositories or Etherscan contracts"
        />

        <div class="extractor-container">
            <!-- Input Section -->
            <div class="card">
                <div class="card-body">
                    <!-- URL Input -->
                    <div class="input-group">
                        <label class="label">📥 Enter Repository or Contract URL</label>
                        <div class="url-input-row">
                            <input
                                v-model="inputUrl"
                                type="text"
                                class="input url-input"
                                placeholder="GitHub/GitLab repo URL, self-hosted GitLab, or Etherscan contract URL"
                                @input="onUrlChange"
                                @keydown.enter="extract"
                            />
                            <button class="btn btn-primary" @click="extract" :disabled="loading || !inputUrl.trim()">
                                <LoadingSpinner v-if="loading" size="sm" />
                                <span v-else>Extract</span>
                            </button>
                        </div>
                    </div>

                    <!-- Examples -->
                    <div class="url-examples">
                        <span class="examples-label">Examples:</span>
                        <button v-for="example in examples" :key="example.label" class="example-btn" @click="setExample(example.url)">
                            {{ example.label }}
                        </button>
                    </div>

                    <!-- Branch Selection (for GitHub/GitLab) -->
                    <div v-if="showBranchSection" class="branch-section">
                        <label class="label">Branch:</label>
                        <div class="branch-row">
                            <select v-model="selectedBranch" class="input select branch-select" :disabled="loadingBranches">
                                <option v-if="branches.length === 0" value="">-- Enter URL to load branches --</option>
                                <option v-for="branch in branches" :key="branch" :value="branch">{{ branch }}</option>
                            </select>
                            <button class="btn btn-secondary btn-sm" @click="loadBranches" :disabled="loadingBranches || !inputUrl.trim()">
                                <LoadingSpinner v-if="loadingBranches" size="sm" />
                                <span v-else>Load Branches</span>
                            </button>
                        </div>
                    </div>

                    <!-- Access Token (optional) -->
                    <div v-if="showBranchSection" class="token-section">
                        <label class="label">Access Token (optional, for private repos):</label>
                        <input
                            v-model="accessToken"
                            type="password"
                            class="input token-input"
                            :class="{ 'token-required': tokenRequired }"
                            placeholder="Enter GitHub or GitLab Access Token"
                        />
                        <div v-if="tokenRequired" class="text-sm text-muted token-hint">Access Token may be required for this repository.</div>
                    </div>

                    <!-- Source Code Input (alternative) -->
                    <details class="source-code-section">
                        <summary class="source-code-toggle">📝 Or paste Solidity source code directly</summary>
                        <div class="source-code-content">
                            <textarea
                                v-model="sourceCode"
                                class="input textarea source-textarea"
                                placeholder="// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MyContract {
    function myFunction(uint256 amount) external returns (bool) { }
}"
                                rows="10"
                            ></textarea>
                            <button class="btn btn-secondary mt-2" @click="extractFromSource" :disabled="loading || !sourceCode.trim()">
                                Extract from Source
                            </button>
                        </div>
                    </details>

                    <!-- Progress Bar -->
                    <div v-if="progress" class="progress-section mt-4">
                        <div class="progress-header">
                            <span class="progress-icon">⏳</span>
                            <span>{{ progress.message }}</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" :style="{ width: progress.percent + '%' }"></div>
                        </div>
                        <div v-if="progress.details" class="progress-details text-sm text-muted">{{ progress.details }}</div>
                    </div>
                </div>
            </div>

            <!-- Error Display -->
            <div v-if="error" class="alert alert-error mt-4">
                <span>❌</span>
                <span>{{ error }}</span>
                <button class="btn btn-secondary btn-sm ml-auto" @click="error = null">Dismiss</button>
            </div>

            <!-- Proxy Info Banner -->
            <div v-if="proxyInfo" class="proxy-banner mt-4">
                <span class="proxy-icon">🔗</span>
                <span
                    >Proxy contract detected at <code>{{ formatAddress(proxyInfo.proxyAddress) }}</code
                    >. Showing implementation contract at <code>{{ formatAddress(proxyInfo.implementationAddress) }}</code
                    >.</span
                >
            </div>

            <!-- Results Section -->
            <div v-if="signatures.length > 0" class="results mt-6">
                <!-- Stats Row -->
                <div class="stats-row">
                    <div class="stat-card">
                        <div class="stat-icon">📁</div>
                        <div class="stat-info">
                            <div class="stat-value">{{ stats.files }}</div>
                            <div class="stat-label">Files</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">⚡</div>
                        <div class="stat-info">
                            <div class="stat-value">{{ stats.functions }}</div>
                            <div class="stat-label">Functions</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">⚠️</div>
                        <div class="stat-info">
                            <div class="stat-value">{{ stats.errors }}</div>
                            <div class="stat-label">Errors</div>
                        </div>
                    </div>
                </div>

                <!-- Result Tabs -->
                <div class="result-tabs mt-4">
                    <button class="tab-btn" :class="{ active: resultTab === 'signatures' }" @click="resultTab = 'signatures'">📋 Signatures</button>
                    <button class="tab-btn" :class="{ active: resultTab === 'abi' }" @click="resultTab = 'abi'">📦 ABI</button>
                </div>

                <!-- Toolbar -->
                <div class="toolbar mt-4">
                    <SearchInput v-model="searchQuery" placeholder="Search signatures..." class="search-input" />

                    <div class="toolbar-actions">
                        <button class="btn btn-sm btn-secondary" @click="copyAll">📋 Copy All</button>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-secondary dropdown-toggle" @click="showExportMenu = !showExportMenu">📥 Export</button>
                            <div v-if="showExportMenu" class="dropdown-menu">
                                <button @click="exportJSON">JSON</button>
                                <button @click="exportCSV">CSV</button>
                                <button @click="exportMarkdown">Markdown</button>
                            </div>
                        </div>
                        <button class="btn btn-sm btn-primary" @click="uploadTo4byte" :disabled="uploading">
                            <LoadingSpinner v-if="uploading" size="sm" />
                            <span v-else>⬆️ Upload to 4byte</span>
                        </button>
                    </div>
                </div>

                <!-- Signatures Tab -->
                <div v-if="resultTab === 'signatures'" class="signatures-tab mt-4">
                    <!-- Pagination Controls -->
                    <div class="pagination-row">
                        <div class="filter-options">
                            <label class="checkbox-label">
                                <input type="checkbox" v-model="showFunctions" />
                                <span>Functions</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" v-model="showErrors" />
                                <span>Errors</span>
                            </label>
                        </div>
                        <div class="pagination-controls">
                            <button class="btn btn-sm btn-secondary" @click="currentPage--" :disabled="currentPage === 1">← Prev</button>
                            <span class="pagination-info">{{ currentPage }} / {{ totalPages }}</span>
                            <button class="btn btn-sm btn-secondary" @click="currentPage++" :disabled="currentPage >= totalPages">Next →</button>
                            <select v-model="pageSize" class="input select pagination-select">
                                <option :value="10">10</option>
                                <option :value="25">25</option>
                                <option :value="50">50</option>
                                <option :value="0">All</option>
                            </select>
                        </div>
                    </div>

                    <!-- Signatures Table -->
                    <div class="signatures-table mt-4">
                        <table>
                            <thead>
                                <tr>
                                    <th class="col-type">Type</th>
                                    <th class="col-name">Name</th>
                                    <th class="col-selector">Selector</th>
                                    <th class="col-signature">Signature</th>
                                    <th class="col-source">Source</th>
                                    <th class="col-actions"></th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="sig in paginatedSignatures" :key="sig.selector + sig.signature">
                                    <td class="col-type">
                                        <span class="type-badge" :class="'type-' + sig.type">{{ sig.type }}</span>
                                    </td>
                                    <td class="col-name">
                                        <code>{{ sig.name }}</code>
                                    </td>
                                    <td class="col-selector">
                                        <code class="selector" @click="copyText(sig.selector)" title="Click to copy">{{ sig.selector }}</code>
                                    </td>
                                    <td class="col-signature">
                                        <code class="signature" :title="sig.signature">{{ truncate(sig.signature, 60) }}</code>
                                    </td>
                                    <td class="col-source">
                                        <span class="source-file" :title="sig.source">{{ getFileName(sig.source) }}</span>
                                    </td>
                                    <td class="col-actions">
                                        <CopyButton :text="sig.signature" size="sm" />
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <EmptyState
                            v-if="filteredSignatures.length === 0 && searchQuery"
                            icon="🔍"
                            title="No matching signatures"
                            description="Try a different search term"
                            class="mt-4"
                        />
                    </div>
                </div>

                <!-- ABI Tab -->
                <div v-if="resultTab === 'abi'" class="abi-tab mt-4">
                    <div v-for="(group, source) in groupedBySource" :key="source" class="abi-group">
                        <details open>
                            <summary class="abi-source-header">
                                📄 {{ source }}
                                <span class="text-muted">({{ group.length }} signatures)</span>
                                <CopyButton :text="formatABI(group)" size="sm" class="ml-2" />
                            </summary>
                            <pre class="abi-code">{{ formatABI(group) }}</pre>
                        </details>
                    </div>
                </div>
            </div>

            <!-- Empty State -->
            <EmptyState
                v-if="signatures.length === 0 && !loading && !error"
                icon="✍️"
                title="No signatures extracted"
                description="Enter a GitHub/GitLab repo URL, Etherscan contract URL, or paste Solidity source code"
                class="mt-6"
            />

            <!-- Upload Result Toast -->
            <div v-if="uploadResult" class="toast-container">
                <div class="toast" :class="uploadResult.success ? 'toast-success' : 'toast-warning'">
                    <span>{{ uploadResult.message }}</span>
                    <button class="toast-close" @click="uploadResult = null">×</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { PageHeader, CopyButton, LoadingSpinner, EmptyState, SearchInput } from "@/components";
import { useClipboard } from "@/composables";
import { processFiles } from "@/utils/solidityParser";
import { parseRepoUrl, fetchGitHubTree, fetchGitHubFile, fetchGitLabTree, fetchEtherscanSource, getProxyImplementation } from "@/utils/api";

const { copy } = useClipboard();

// Examples matching reference
const examples = [
    { label: "OpenZeppelin", url: "https://github.com/OpenZeppelin/openzeppelin-contracts" },
    { label: "Uniswap V3", url: "https://github.com/Uniswap/v3-core" },
    { label: "WETH", url: "https://etherscan.io/address/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" },
    { label: "Uniswap Router", url: "https://etherscan.io/address/0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D" },
];

// Input state
const inputUrl = ref("");
const accessToken = ref("");
const sourceCode = ref("");
const tokenRequired = ref(false);

// Branch state
const branches = ref([]);
const selectedBranch = ref("main");
const loadingBranches = ref(false);

// Loading state
const loading = ref(false);
const error = ref(null);
const progress = ref(null);

// Proxy detection
const proxyInfo = ref(null);

// Result state
const signatures = ref([]);
const stats = ref({ functions: 0, errors: 0, files: 0 });
const resultTab = ref("signatures");

// Filters
const searchQuery = ref("");
const showFunctions = ref(true);
const showErrors = ref(true);

// Pagination
const pageSize = ref(25);
const currentPage = ref(1);

// Export menu
const showExportMenu = ref(false);

// Upload state
const uploading = ref(false);
const uploadResult = ref(null);

// Computed
const showBranchSection = computed(() => {
    const parsed = parseRepoUrl(inputUrl.value);
    return parsed && (parsed.platform === "github" || parsed.platform === "gitlab");
});

const isAuthError = (err) => {
    const message = (err?.message || String(err || "")).toLowerCase();
    return (
        message.includes("401") ||
        message.includes("403") ||
        message.includes("authentication") ||
        message.includes("access denied") ||
        message.includes("private") ||
        message.includes("rate limit")
    );
};

const filteredSignatures = computed(() => {
    let list = signatures.value;

    if (!showFunctions.value) {
        list = list.filter((s) => s.type !== "function");
    }
    if (!showErrors.value) {
        list = list.filter((s) => s.type !== "error");
    }

    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        list = list.filter(
            (s) => s.signature.toLowerCase().includes(query) || s.selector.toLowerCase().includes(query) || s.name?.toLowerCase().includes(query),
        );
    }

    return list;
});

const totalPages = computed(() => {
    if (pageSize.value === 0) return 1;
    return Math.max(1, Math.ceil(filteredSignatures.value.length / pageSize.value));
});

const paginatedSignatures = computed(() => {
    if (pageSize.value === 0) return filteredSignatures.value;
    const start = (currentPage.value - 1) * pageSize.value;
    return filteredSignatures.value.slice(start, start + pageSize.value);
});

const groupedBySource = computed(() => {
    const groups = {};
    for (const sig of signatures.value) {
        const source = sig.source || "Unknown";
        if (!groups[source]) groups[source] = [];
        groups[source].push(sig);
    }
    return groups;
});

// Watch for filter/page changes
watch([searchQuery, showFunctions, showErrors, pageSize], () => {
    currentPage.value = 1;
});

// Close export menu when clicking outside
watch(showExportMenu, (val) => {
    if (val) {
        setTimeout(() => {
            document.addEventListener("click", closeExportMenu, { once: true });
        }, 0);
    }
});

function closeExportMenu() {
    showExportMenu.value = false;
}

function setExample(url) {
    inputUrl.value = url;
    onUrlChange();
}

// Debounced URL change handler for branch loading
let urlChangeTimeout = null;
function onUrlChange() {
    clearTimeout(urlChangeTimeout);
    branches.value = [];
    tokenRequired.value = false;

    const parsed = parseRepoUrl(inputUrl.value);
    if (parsed && (parsed.platform === "github" || parsed.platform === "gitlab")) {
        urlChangeTimeout = setTimeout(loadBranches, 500);
    }
}

async function loadBranches() {
    const url = inputUrl.value.trim();
    if (!url) return;

    const parsed = parseRepoUrl(url);
    if (!parsed || parsed.platform === "etherscan") return;

    loadingBranches.value = true;
    tokenRequired.value = false;

    try {
        if (parsed.platform === "github") {
            const headers = { Accept: "application/vnd.github.v3+json" };
            if (accessToken.value) {
                headers["Authorization"] = "token " + accessToken.value;
            }
            const response = await fetch("https://api.github.com/repos/" + parsed.owner + "/" + parsed.repo + "/branches", { headers });
            if (!response.ok) {
                throw new Error("GitHub API error: " + response.status);
            }
            if (response.ok) {
                const data = await response.json();
                branches.value = data.map((b) => b.name);
                if (branches.value.length > 0 && !branches.value.includes(selectedBranch.value)) {
                    selectedBranch.value = branches.value[0];
                }
            }
        } else if (parsed.platform === "gitlab") {
            const projectId = encodeURIComponent(parsed.projectPath);
            const headers = {};
            if (accessToken.value) {
                headers["PRIVATE-TOKEN"] = accessToken.value;
            }
            const response = await fetch(parsed.host + "/api/v4/projects/" + projectId + "/repository/branches", { headers });
            if (!response.ok) {
                throw new Error("GitLab API error: " + response.status);
            }
            if (response.ok) {
                const data = await response.json();
                branches.value = data.map((b) => b.name);
                if (branches.value.length > 0 && !branches.value.includes(selectedBranch.value)) {
                    selectedBranch.value = branches.value[0];
                }
            }
        }
    } catch (e) {
        console.warn("Failed to load branches:", e);
        if (isAuthError(e) && !accessToken.value.trim()) {
            tokenRequired.value = true;
        }
    } finally {
        loadingBranches.value = false;
    }
}

async function extract() {
    const url = inputUrl.value.trim();
    if (!url) return;

    loading.value = true;
    error.value = null;
    tokenRequired.value = false;
    signatures.value = [];
    stats.value = { functions: 0, errors: 0, files: 0 };
    proxyInfo.value = null;
    uploadResult.value = null;
    progress.value = { percent: 0, message: "Parsing URL..." };

    try {
        const parsed = parseRepoUrl(url);
        if (!parsed) {
            throw new Error("Invalid URL format. Use GitHub, GitLab (including self-hosted), or Etherscan URLs.");
        }

        const files = [];

        if (parsed.platform === "github") {
            await extractFromGitHub(parsed, files);
        } else if (parsed.platform === "gitlab") {
            await extractFromGitLab(parsed, files);
        } else if (parsed.platform === "etherscan") {
            await extractFromEtherscan(parsed, files);
        }

        if (files.length === 0) {
            throw new Error("No Solidity files found");
        }

        progress.value = { percent: 80, message: "Parsing signatures..." };

        const result = processFiles(files);
        signatures.value = [...result.functions, ...result.errors];
        stats.value = {
            functions: result.stats.uniqueFunctions,
            errors: result.stats.uniqueErrors,
            files: files.length,
        };

        progress.value = { percent: 100, message: "Done!" };
        setTimeout(() => {
            progress.value = null;
        }, 1000);
    } catch (e) {
        error.value = e.message;
        if (isAuthError(e) && !accessToken.value.trim()) {
            tokenRequired.value = true;
        }
        progress.value = null;
    } finally {
        loading.value = false;
    }
}

watch(accessToken, (value) => {
    if (tokenRequired.value && value.trim()) {
        tokenRequired.value = false;
    }

    const parsed = parseRepoUrl(inputUrl.value);
    if (parsed && (parsed.platform === "github" || parsed.platform === "gitlab")) {
        clearTimeout(urlChangeTimeout);
        urlChangeTimeout = setTimeout(loadBranches, 300);
    }
});

async function extractFromGitHub(parsed, files) {
    progress.value = { percent: 10, message: "Fetching repository tree..." };

    const branch = selectedBranch.value || parsed.branch || "main";
    const tree = await fetchGitHubTree(parsed.owner, parsed.repo, branch, accessToken.value || null);
    const solFiles = tree.tree.filter((f) => f.path.endsWith(".sol") && !f.path.includes(".t.sol") && !f.path.includes("test/") && !f.path.includes("mock/"));

    if (solFiles.length === 0) {
        throw new Error("No Solidity files found in repository");
    }

    progress.value = { percent: 20, message: "Found " + solFiles.length + " Solidity files..." };

    // Fetch files in batches
    const batchSize = 5;
    for (let i = 0; i < solFiles.length; i += batchSize) {
        const batch = solFiles.slice(i, i + batchSize);
        const fetchPromises = batch.map(async (file) => {
            try {
                const content = await fetchGitHubFile(parsed.owner, parsed.repo, file.path, branch, accessToken.value || null);
                return { path: file.path, content };
            } catch {
                return null;
            }
        });

        const results = await Promise.all(fetchPromises);
        files.push(...results.filter(Boolean));

        const percent = 20 + Math.floor((i / solFiles.length) * 60);
        progress.value = { percent, message: "Fetching files... (" + files.length + "/" + solFiles.length + ")" };
    }
}

async function extractFromGitLab(parsed, files) {
    progress.value = { percent: 10, message: "Fetching GitLab repository tree..." };

    const branch = selectedBranch.value || parsed.branch || "main";
    const tree = await fetchGitLabTree(parsed.host, parsed.projectPath, branch, accessToken.value || null);
    const solFiles = tree.filter((f) => f.path.endsWith(".sol") && !f.path.includes(".t.sol") && !f.path.includes("test/") && !f.path.includes("mock/"));

    if (solFiles.length === 0) {
        throw new Error("No Solidity files found in GitLab repository");
    }

    progress.value = { percent: 20, message: "Found " + solFiles.length + " Solidity files..." };

    const batchSize = 5;
    for (let i = 0; i < solFiles.length; i += batchSize) {
        const batch = solFiles.slice(i, i + batchSize);
        const fetchPromises = batch.map(async (file) => {
            try {
                const projectId = encodeURIComponent(parsed.projectPath);
                const filePath = encodeURIComponent(file.path);
                const headers = {};
                if (accessToken.value) {
                    headers["PRIVATE-TOKEN"] = accessToken.value;
                }
                const response = await fetch(parsed.host + "/api/v4/projects/" + projectId + "/repository/files/" + filePath + "/raw?ref=" + branch, {
                    headers,
                });
                if (!response.ok) return null;
                const content = await response.text();
                return { path: file.path, content };
            } catch {
                return null;
            }
        });

        const results = await Promise.all(fetchPromises);
        files.push(...results.filter(Boolean));

        const percent = 20 + Math.floor((i / solFiles.length) * 60);
        progress.value = { percent, message: "Fetching files... (" + files.length + "/" + solFiles.length + ")" };
    }
}

async function extractFromEtherscan(parsed, files) {
    progress.value = { percent: 20, message: "Fetching contract source from Etherscan..." };

    console.log("[SignatureExtractor] Etherscan parsed:", parsed);

    // Check for proxy
    const implementation = await getProxyImplementation(parsed.chainId, parsed.address);

    let sourceResult;

    if (implementation) {
        proxyInfo.value = {
            proxyAddress: parsed.address,
            implementationAddress: implementation,
        };
        progress.value = { percent: 40, message: "Fetching implementation source..." };
        sourceResult = await fetchEtherscanSource(parsed.chainId, implementation);
    } else {
        sourceResult = await fetchEtherscanSource(parsed.chainId, parsed.address);
    }

    progress.value = { percent: 60, message: "Parsing source files..." };
    files.push(...parseEtherscanSource(sourceResult, sourceResult.ContractName || "Contract"));
}

function parseEtherscanSource(sourceResult, contractName) {
    const files = [];
    let sourceCodeStr = sourceResult.SourceCode;

    // Handle JSON format
    if (sourceCodeStr.startsWith("{{")) {
        sourceCodeStr = sourceCodeStr.slice(1, -1);
    }

    try {
        const parsed = JSON.parse(sourceCodeStr);

        if (parsed.sources) {
            for (const [filePath, fileData] of Object.entries(parsed.sources)) {
                if (filePath.endsWith(".sol") && !filePath.endsWith(".t.sol")) {
                    files.push({ path: filePath, content: fileData.content });
                }
            }
        } else {
            for (const [filePath, content] of Object.entries(parsed)) {
                if (filePath.endsWith(".sol") && !filePath.endsWith(".t.sol")) {
                    files.push({
                        path: filePath,
                        content: typeof content === "string" ? content : content.content,
                    });
                }
            }
        }
    } catch {
        // Single file
        files.push({ path: contractName + ".sol", content: sourceCodeStr });
    }

    return files;
}

async function extractFromSource() {
    if (!sourceCode.value.trim()) return;

    loading.value = true;
    error.value = null;
    signatures.value = [];
    stats.value = { functions: 0, errors: 0, files: 0 };
    proxyInfo.value = null;
    progress.value = { percent: 50, message: "Parsing source code..." };

    try {
        const files = [{ path: "source.sol", content: sourceCode.value }];
        const result = processFiles(files);

        signatures.value = [...result.functions, ...result.errors];
        stats.value = {
            functions: result.stats.uniqueFunctions,
            errors: result.stats.uniqueErrors,
            files: 1,
        };

        progress.value = { percent: 100, message: "Done!" };
        setTimeout(() => {
            progress.value = null;
        }, 1000);
    } catch (e) {
        error.value = e.message;
        progress.value = null;
    } finally {
        loading.value = false;
    }
}

// Utility functions
function formatAddress(addr) {
    if (!addr) return "";
    return addr.slice(0, 10) + "..." + addr.slice(-8);
}

function truncate(str, maxLen) {
    if (!str || str.length <= maxLen) return str;
    return str.substring(0, maxLen - 3) + "...";
}

function getFileName(path) {
    if (!path) return "";
    return path.split("/").pop();
}

async function copyText(text) {
    await copy(text);
}

async function copyAll() {
    const text = signatures.value.map((s) => s.selector + ": " + s.signature).join("\n");
    await copy(text);
}

function formatABI(sigs) {
    const abi = sigs
        .map((sig) => {
            if (sig.type === "function") {
                return {
                    type: "function",
                    name: sig.name,
                    inputs: parseInputsFromSignature(sig.signature),
                    outputs: [],
                    stateMutability: "nonpayable",
                };
            } else if (sig.type === "error") {
                return {
                    type: "error",
                    name: sig.name,
                    inputs: parseInputsFromSignature(sig.signature),
                };
            }
            return null;
        })
        .filter(Boolean);

    return JSON.stringify(abi, null, 2);
}

function parseInputsFromSignature(sig) {
    const match = sig.match(/\(([^)]*)\)/);
    if (!match || !match[1]) return [];

    const types = match[1].split(",").filter(Boolean);
    return types.map((type, i) => ({
        type: type.trim(),
        name: "param" + i,
    }));
}

function exportJSON() {
    const data = JSON.stringify(signatures.value, null, 2);
    downloadFile(data, "signatures.json", "application/json");
    showExportMenu.value = false;
}

function exportCSV() {
    const header = "selector,signature,type,name,source\n";
    const rows = signatures.value.map((s) => s.selector + ',"' + s.signature + '",' + s.type + "," + s.name + ',"' + (s.source || "") + '"').join("\n");
    downloadFile(header + rows, "signatures.csv", "text/csv");
    showExportMenu.value = false;
}

function exportMarkdown() {
    let md = "# Function Signatures\n\n";
    md += "| Selector | Signature | Type |\n";
    md += "|----------|-----------|------|\n";
    for (const sig of signatures.value) {
        md += "| `" + sig.selector + "` | `" + sig.signature + "` | " + sig.type + " |\n";
    }
    downloadFile(md, "signatures.md", "text/markdown");
    showExportMenu.value = false;
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

async function uploadTo4byte() {
    if (signatures.value.length === 0) return;

    uploading.value = true;
    uploadResult.value = null;

    try {
        const functionSigs = signatures.value.filter((s) => s.type === "function");
        let success = 0;
        let failed = 0;

        for (let i = 0; i < functionSigs.length; i += 10) {
            const batch = functionSigs.slice(i, i + 10);

            for (const sig of batch) {
                try {
                    const response = await fetch("https://www.4byte.directory/api/v1/signatures/", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ text_signature: sig.signature }),
                    });

                    if (response.ok || response.status === 400) {
                        success++;
                    } else {
                        failed++;
                    }
                } catch {
                    failed++;
                }
            }

            await new Promise((r) => setTimeout(r, 100));
        }

        uploadResult.value = {
            success: failed === 0,
            message: "Uploaded " + success + " signatures" + (failed > 0 ? ", " + failed + " failed" : ""),
        };

        setTimeout(() => {
            uploadResult.value = null;
        }, 5000);
    } catch (e) {
        uploadResult.value = {
            success: false,
            message: "Upload failed: " + e.message,
        };
    } finally {
        uploading.value = false;
    }
}
</script>

<style scoped>
.extractor-container {
    max-width: 1000px;
}

.input-group {
    margin-bottom: var(--space-4);
}

.url-input-row {
    display: flex;
    gap: var(--space-2);
}

.url-input {
    flex: 1;
}

.url-examples {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-top: var(--space-2);
}

.examples-label {
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
}

.example-btn {
    padding: var(--space-1) var(--space-2);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    font-size: var(--text-xs);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.example-btn:hover {
    background: var(--color-accent-primary);
    color: var(--color-text-inverse);
    border-color: var(--color-accent-primary);
}

.branch-section {
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border-primary);
}

.branch-row {
    display: flex;
    gap: var(--space-2);
    align-items: center;
}

.branch-select {
    width: 200px;
}

.token-section {
    margin-top: var(--space-3);
}

.token-input {
    max-width: 400px;
}

.token-input.token-required {
    border-color: var(--color-accent-warning);
    background: rgba(245, 158, 11, 0.08);
    animation: pulse-warning 1.5s ease-in-out infinite;
}

.token-hint {
    margin-top: var(--space-2);
}

@keyframes pulse-warning {
    0%,
    100% {
        box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.35);
    }
    50% {
        box-shadow: 0 0 0 6px rgba(245, 158, 11, 0);
    }
}

.source-code-section {
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border-primary);
}

.source-code-toggle {
    cursor: pointer;
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
}

.source-code-content {
    margin-top: var(--space-3);
}

.source-textarea {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
}

.progress-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.progress-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
}

.progress-bar {
    height: 4px;
    background: var(--color-bg-tertiary);
    border-radius: 2px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: var(--color-accent-primary);
    transition: width 0.3s ease;
}

.proxy-banner {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: rgb(59 130 246 / 0.1);
    border: 1px solid rgb(59 130 246 / 0.3);
    border-radius: var(--radius-md);
}

.stats-row {
    display: flex;
    gap: var(--space-4);
    flex-wrap: wrap;
}

.stat-card {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-md);
    min-width: 120px;
}

.stat-icon {
    font-size: var(--text-xl);
}

.stat-value {
    font-size: var(--text-lg);
    font-weight: var(--font-bold);
}

.stat-label {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
}

.result-tabs {
    display: flex;
    gap: var(--space-2);
    border-bottom: 1px solid var(--color-border-primary);
    padding-bottom: var(--space-2);
}

.tab-btn {
    padding: var(--space-2) var(--space-4);
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.tab-btn:hover {
    background: var(--color-bg-hover);
}

.tab-btn.active {
    background: var(--color-accent-primary);
    color: var(--color-text-inverse);
}

.toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
}

.search-input {
    flex: 1;
    min-width: 200px;
    max-width: 300px;
}

.toolbar-actions {
    display: flex;
    gap: var(--space-2);
}

.dropdown {
    position: relative;
}

.dropdown-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: var(--space-1);
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 100;
    min-width: 120px;
}

.dropdown-menu button {
    display: block;
    width: 100%;
    padding: var(--space-2) var(--space-4);
    text-align: left;
    background: transparent;
    border: none;
    color: var(--color-text-primary);
    cursor: pointer;
}

.dropdown-menu button:hover {
    background: var(--color-bg-hover);
}

.pagination-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-3);
}

.filter-options {
    display: flex;
    gap: var(--space-4);
}

.checkbox-label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
    font-size: var(--text-sm);
}

.pagination-controls {
    display: flex;
    align-items: center;
    gap: var(--space-2);
}

.pagination-info {
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
    min-width: 60px;
    text-align: center;
}

.pagination-select {
    width: auto;
    min-width: 60px;
}

.signatures-table {
    overflow-x: auto;
}

.signatures-table table {
    width: 100%;
    border-collapse: collapse;
}

.signatures-table th,
.signatures-table td {
    padding: var(--space-2) var(--space-3);
    text-align: left;
    border-bottom: 1px solid var(--color-border-primary);
}

.signatures-table th {
    background: var(--color-bg-secondary);
    font-weight: var(--font-medium);
    font-size: var(--text-xs);
    text-transform: uppercase;
    color: var(--color-text-secondary);
}

.col-type {
    width: 80px;
}

.col-selector {
    width: 100px;
}

.col-actions {
    width: 40px;
}

.type-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    text-transform: capitalize;
}

.type-function {
    background: rgb(59 130 246 / 0.1);
    color: rgb(59 130 246);
}

.type-error {
    background: rgb(239 68 68 / 0.1);
    color: rgb(239 68 68);
}

.selector {
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
}

.selector:hover {
    color: var(--color-accent-primary);
}

.signature {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    word-break: break-all;
}

.source-file {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
}

.abi-group {
    margin-bottom: var(--space-4);
}

.abi-source-header {
    padding: var(--space-3);
    background: var(--color-bg-secondary);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-weight: var(--font-medium);
}

.abi-code {
    margin-top: var(--space-2);
    padding: var(--space-4);
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-md);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    overflow-x: auto;
    max-height: 400px;
    overflow-y: auto;
}

.toast-container {
    position: fixed;
    bottom: var(--space-4);
    right: var(--space-4);
    z-index: 1000;
}

.toast {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
}

.toast-success {
    background: rgb(34 197 94);
    color: white;
}

.toast-warning {
    background: rgb(234 179 8);
    color: black;
}

.toast-close {
    background: transparent;
    border: none;
    color: inherit;
    font-size: var(--text-lg);
    cursor: pointer;
    opacity: 0.7;
}

.toast-close:hover {
    opacity: 1;
}

.ml-auto {
    margin-left: auto;
}

.ml-2 {
    margin-left: var(--space-2);
}

.mt-2 {
    margin-top: var(--space-2);
}
</style>
