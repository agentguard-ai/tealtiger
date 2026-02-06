module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/agentguard-landing/lib/metrics.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Metrics Utility Functions
 * 
 * Functions to fetch GitHub stars, npm downloads, and PyPI downloads.
 */ __turbopack_context__.s([
    "fetchAllMetrics",
    ()=>fetchAllMetrics,
    "fetchGitHubStars",
    ()=>fetchGitHubStars,
    "fetchNpmDownloads",
    ()=>fetchNpmDownloads,
    "fetchPyPiDownloads",
    ()=>fetchPyPiDownloads
]);
async function fetchGitHubStars(repo) {
    try {
        const response = await fetch(`https://api.github.com/repos/${repo}`, {
            next: {
                revalidate: 3600
            }
        });
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }
        const data = await response.json();
        return data.stargazers_count || 0;
    } catch (error) {
        console.error('Error fetching GitHub stars:', error);
        return 0; // Fallback value
    }
}
async function fetchNpmDownloads(packageName) {
    try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        const start = startDate.toISOString().split('T')[0];
        const end = endDate.toISOString().split('T')[0];
        const response = await fetch(`https://api.npmjs.org/downloads/point/${start}:${end}/${packageName}`, {
            next: {
                revalidate: 3600
            }
        });
        if (!response.ok) {
            throw new Error(`npm API error: ${response.status}`);
        }
        const data = await response.json();
        return data.downloads || 0;
    } catch (error) {
        console.error('Error fetching npm downloads:', error);
        return 0; // Fallback value
    }
}
async function fetchPyPiDownloads(packageName) {
    try {
        const response = await fetch(`https://pypistats.org/api/packages/${packageName}/recent?period=month`, {
            next: {
                revalidate: 3600
            }
        });
        if (!response.ok) {
            throw new Error(`PyPI stats API error: ${response.status}`);
        }
        const data = await response.json();
        return data.data?.last_month || 0;
    } catch (error) {
        console.error('Error fetching PyPI downloads:', error);
        return 0; // Fallback value
    }
}
async function fetchAllMetrics() {
    const [githubStars, npmDownloads, pypiDownloads] = await Promise.all([
        fetchGitHubStars('nagasatish007/ai-agent-security-platform'),
        fetchNpmDownloads('agentguard-sdk'),
        fetchPyPiDownloads('agentguard')
    ]);
    return {
        githubStars,
        npmDownloads,
        pypiDownloads
    };
}
}),
"[project]/agentguard-landing/app/api/metrics/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "revalidate",
    ()=>revalidate
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$agentguard$2d$landing$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/agentguard-landing/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$agentguard$2d$landing$2f$lib$2f$metrics$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/agentguard-landing/lib/metrics.ts [app-route] (ecmascript)");
;
;
const revalidate = 3600; // Revalidate every hour (ISR)
async function GET() {
    try {
        const metrics = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$agentguard$2d$landing$2f$lib$2f$metrics$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["fetchAllMetrics"])();
        return __TURBOPACK__imported__module__$5b$project$5d2f$agentguard$2d$landing$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(metrics, {
            headers: {
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200'
            }
        });
    } catch (error) {
        console.error('Error in metrics API route:', error);
        // Return fallback values on error
        return __TURBOPACK__imported__module__$5b$project$5d2f$agentguard$2d$landing$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            githubStars: 0,
            npmDownloads: 0,
            pypiDownloads: 0
        }, {
            status: 200,
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
            }
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1bdc3204._.js.map