(function (root, factory) {
    const api = factory();
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    root.AvatarClient = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    function apiBase() {
        if (typeof location === "undefined" || location.protocol === "file:") {
            return "http://localhost:5000";
        }
        return location.origin;
    }

    function authHeaders(token, extra) {
        const headers = { ...(extra || {}) };
        if (token) headers.Authorization = `Bearer ${token}`;
        return headers;
    }

    function withToken(url, token, base) {
        const root = base == null ? apiBase() : base;
        const absolute = /^https?:\/\//.test(url) ? url : `${root}${url}`;
        if (!token) return absolute;
        const join = absolute.includes("?") ? "&" : "?";
        return `${absolute}${join}access_token=${encodeURIComponent(token)}`;
    }

    function validateGenerateInput({ prompt, photo, variations }) {
        const errors = [];
        const text = String(prompt || "").trim();
        if (!photo && !text) errors.push("Enter a description or choose a photo.");
        if (text.length > 1000) errors.push("Description must be 1000 characters or fewer.");
        const count = Number(variations == null || variations === "" ? 1 : variations);
        if (!Number.isInteger(count) || count < 1 || count > 4) {
            errors.push("Choose between 1 and 4 variations.");
        }
        return errors;
    }

    function statusText(job) {
        if (!job) return "Working…";
        if (job.status === "failed") return job.error?.message || "Generation failed.";
        if (job.status === "completed") {
            const count = job.result?.images?.length || 0;
            const ready = count === 1 ? "Avatar ready." : `${count} variations ready.`;
            if (job.warnings?.length) return `${ready} ${job.warnings[0]}`;
            return ready;
        }
        if (job.stage === "describing") return "Reading your photo…";
        if (job.stage === "enhancing") return "Enhancing prompt…";
        if (job.stage === "generating") {
            const done = job.progress?.completed || 0;
            const total = job.progress?.total || 1;
            return `Generating variation ${Math.min(done + 1, total)} of ${total}…`;
        }
        if (job.status === "queued") return "Queued…";
        return "Working…";
    }

    async function pollJob(jobId, options = {}) {
        const fetchImpl = options.fetchImpl || fetch;
        const base = options.base == null ? apiBase() : options.base;
        const headers = options.headers || {};
        const intervalMs = options.intervalMs == null ? 1000 : options.intervalMs;
        const timeoutMs = options.timeoutMs == null ? 120000 : options.timeoutMs;
        const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
        const started = Date.now();

        while (Date.now() - started <= timeoutMs) {
            const response = await fetchImpl(`${base}/avatar/jobs/${jobId}`, { headers });
            let data = {};
            try {
                data = await response.json();
            } catch {
                data = {};
            }
            if (!response.ok) {
                const error = new Error(data.error || "Could not check generation status.");
                error.code = data.code || "STATUS_FAILED";
                throw error;
            }
            if (options.onUpdate) options.onUpdate(data);
            if (data.status === "completed" || data.status === "failed") return data;
            await sleep(intervalMs);
        }

        const error = new Error("Generation timed out. Check your avatar history in a moment.");
        error.code = "TIMEOUT";
        throw error;
    }

    return {
        apiBase,
        authHeaders,
        withToken,
        validateGenerateInput,
        statusText,
        pollJob
    };
});
