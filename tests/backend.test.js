const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const { createApp } = require("../backend/app");
const { createStore } = require("../backend/lib/store");
const { createAi, localEnhance, DEFAULT_TEXT_MODEL } = require("../backend/lib/ai");
const { buildImageRequests, generateImage, detectImageType } = require("../backend/lib/images");

const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
);

function pngResult() {
    return { buffer: Buffer.from(PNG), contentType: "image/png", ext: ".png", provider: "test" };
}

function testAi(extra = {}) {
    return {
        textModel: DEFAULT_TEXT_MODEL,
        async enhance(prompt, style) {
            extra.enhanceArgs = { prompt, style };
            return { prompt: `Enhanced ${style}: ${prompt}`, source: "groq", warning: null };
        },
        async describePhoto(buffer, mimeType) {
            extra.describeArgs = { bytes: buffer.length, mimeType };
            return "short dark hair and a green hoodie";
        }
    };
}

async function withApp(overrides, fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "avatarforge-"));
    const store = createStore(dir);
    const recorded = {};
    const app = createApp({
        dataDir: dir,
        store,
        authSecret: "test-secret",
        ai: overrides.ai || testAi(recorded),
        imageGen: overrides.imageGen || { async generate() { return pngResult(); } }
    });
    const server = await new Promise((resolve) => {
        const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
    });
    try {
        await fn({
            base: `http://127.0.0.1:${server.address().port}`,
            store,
            dir,
            recorded
        });
    } finally {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

async function jsonRequest(base, pathname, { method = "GET", token, body } = {}) {
    const response = await fetch(`${base}${pathname}`, {
        method,
        headers: {
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    return { status: response.status, payload };
}

async function register(base, username, password = "password1") {
    return jsonRequest(base, "/auth/register", {
        method: "POST",
        body: { username, password }
    });
}

async function waitForJob(base, jobId, token) {
    const started = Date.now();
    while (Date.now() - started < 5000) {
        const { status, payload } = await jsonRequest(base, `/avatar/jobs/${jobId}`, { token });
        if (status === 200 && (payload.status === "completed" || payload.status === "failed")) return payload;
        await new Promise((resolve) => setTimeout(resolve, 15));
    }
    throw new Error(`Job ${jobId} did not finish`);
}

test("prompt enhancement and image requests use the live providers", async () => {
    assert.equal(DEFAULT_TEXT_MODEL, "qwen/qwen3.8-27b");
    assert.match(localEnhance("blue hair", "Pixel Art"), /Pixel Art/);
    assert.match(localEnhance("blue hair", "Pixel Art"), /blue hair/);

    const plain = buildImageRequests({ prompt: "red circle", seed: 7, apiKey: "" });
    assert.equal(plain.length, 1);
    assert.match(plain[0].url, /^https:\/\/image\.pollinations\.ai\/prompt\//);
    assert.equal(plain[0].headers.Authorization, undefined);

    const keyed = buildImageRequests({ prompt: "red circle", seed: 7, apiKey: "secret-key" });
    assert.equal(keyed.length, 2);
    assert.match(keyed[0].url, /^https:\/\/gen\.pollinations\.ai\/image\//);
    assert.equal(keyed[0].headers.Authorization, "Bearer secret-key");

    const generated = await generateImage({
        prompt: "red circle",
        seed: 7,
        apiKey: "secret-key",
        fetchImpl: async (url) => {
            if (url.startsWith("https://gen.pollinations.ai/")) {
                return {
                    ok: false,
                    status: 401,
                    arrayBuffer: async () => Buffer.from(JSON.stringify({ error: "unauthorized" })),
                    headers: { get: () => "application/json" }
                };
            }
            return {
                ok: true,
                status: 200,
                arrayBuffer: async () => PNG,
                headers: { get: () => "image/png" }
            };
        }
    });
    assert.equal(generated.provider, "pollinations-legacy");
    assert.equal(detectImageType(generated.buffer).contentType, "image/png");
});

test("language model failure falls back to a local prompt", async () => {
    const ai = createAi({
        apiKey: "test",
        client: {
            chat: {
                completions: {
                    async create() {
                        throw new Error("model missing");
                    }
                }
            }
        }
    });
    const enhanced = await ai.enhance("kind librarian", "Watercolor");
    assert.equal(enhanced.source, "local");
    assert.match(enhanced.prompt, /Watercolor/);
    assert.match(enhanced.warning, /local template/);
});

test("accounts, private history, variations, and stored images", async () => {
    const seeds = [];
    await withApp({
        imageGen: {
            async generate({ seed }) {
                seeds.push(seed);
                return pngResult();
            }
        }
    }, async ({ base, dir }) => {
        const health = await jsonRequest(base, "/health");
        assert.equal(health.payload.ok, true);
        assert.equal(health.payload.textModel, "qwen/qwen3.8-27b");

        const bad = await register(base, "ab", "short");
        assert.equal(bad.status, 400);

        const created = await register(base, "Ada_1");
        assert.equal(created.status, 201);
        assert.equal(created.payload.user.username, "Ada_1");
        assert.equal(created.payload.user.hash, undefined);
        const token = created.payload.token;

        const duplicate = await register(base, "ada_1");
        assert.equal(duplicate.status, 409);

        const wrong = await jsonRequest(base, "/auth/login", {
            method: "POST",
            body: { username: "Ada_1", password: "nope-nope" }
        });
        assert.equal(wrong.status, 401);

        const me = await jsonRequest(base, "/auth/me", { token });
        assert.equal(me.payload.user.username, "Ada_1");
        const anonymous = await jsonRequest(base, "/avatar/history");
        assert.equal(anonymous.status, 401);

        const missing = await jsonRequest(base, "/avatar/generate", {
            method: "POST",
            token,
            body: { prompt: "   ", variations: 1 }
        });
        assert.equal(missing.status, 400);

        const started = await jsonRequest(base, "/avatar/generate", {
            method: "POST",
            token,
            body: { prompt: "lighthouse keeper", style: "Anime", variations: 3, enhance: true, source: "manual" }
        });
        assert.equal(started.status, 202);
        const job = await waitForJob(base, started.payload.jobId, token);
        assert.equal(job.status, "completed");
        assert.equal(job.result.images.length, 3);
        assert.equal(job.result.enhancementSource, "groq");
        assert.match(job.result.enhancedPrompt, /lighthouse keeper/);
        assert.equal(job.result.source, "manual");
        assert.equal(new Set(seeds).size, 3);

        const history = await jsonRequest(base, "/avatar/history", { token });
        assert.equal(history.payload.avatars.length, 1);
        const imageUrl = history.payload.avatars[0].images[0].url;
        const imagePath = path.join(dir, "images");
        assert.equal(fs.readdirSync(imagePath).length, 3);
        const saved = fs.readFileSync(path.join(imagePath, fs.readdirSync(imagePath)[0]));
        assert.equal(detectImageType(saved).contentType, "image/png");

        const owned = await fetch(`${base}${imageUrl}`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(owned.status, 200);
        assert.equal(owned.headers.get("content-type"), "image/png");

        const other = await register(base, "Bea_2");
        const hiddenJob = await jsonRequest(base, `/avatar/jobs/${started.payload.jobId}`, { token: other.payload.token });
        assert.equal(hiddenJob.status, 404);
        const hiddenImage = await fetch(`${base}${imageUrl}`, { headers: { Authorization: `Bearer ${other.payload.token}` } });
        assert.equal(hiddenImage.status, 404);
        const otherHistory = await jsonRequest(base, "/avatar/history", { token: other.payload.token });
        assert.deepEqual(otherHistory.payload.avatars, []);

        const guestImage = await fetch(`${base}${imageUrl}`);
        assert.equal(guestImage.status, 404);
    });
});

test("generation failure is reported and nothing is saved to history", async () => {
    let release;
    const gate = new Promise((resolve) => {
        release = resolve;
    });
    let sawGenerating = false;
    await withApp({
        imageGen: {
            async generate() {
                sawGenerating = true;
                await gate;
                const error = new Error("The image service rejected the prompt.");
                error.code = "UPSTREAM";
                throw error;
            }
        }
    }, async ({ base }) => {
        const created = await register(base, "Cara_3");
        const started = await jsonRequest(base, "/avatar/generate", {
            method: "POST",
            token: created.payload.token,
            body: { prompt: "quiet botanist", variations: 1, enhance: false }
        });
        const processing = await (async () => {
            const began = Date.now();
            while (Date.now() - began < 3000) {
                const current = await jsonRequest(base, `/avatar/jobs/${started.payload.jobId}`, {
                    token: created.payload.token
                });
                if (current.payload.stage === "generating" || current.payload.status === "failed") return current.payload;
                await new Promise((resolve) => setTimeout(resolve, 10));
            }
            return null;
        })();
        assert.equal(processing.stage, "generating");
        release();
        const job = await waitForJob(base, started.payload.jobId, created.payload.token);
        assert.equal(job.status, "failed");
        assert.equal(job.error.code, "GENERATION_FAILED");
        assert.match(job.error.message, /image service/i);
        const history = await jsonRequest(base, "/avatar/history", { token: created.payload.token });
        assert.deepEqual(history.payload.avatars, []);
        assert.equal(sawGenerating, true);
    });
});

test("photo transformation stores the upload and uses the description", async () => {
    await withApp({}, async ({ base, dir, recorded }) => {
        const created = await register(base, "Dina_4");
        const body = new FormData();
        body.append("style", "Cyberpunk");
        body.append("prompt", "make them a hero");
        body.append("variations", "2");
        body.append("enhance", "true");
        body.append("photo", new Blob([PNG], { type: "image/png" }), "portrait.png");
        const response = await fetch(`${base}/avatar/transform`, {
            method: "POST",
            headers: { Authorization: `Bearer ${created.payload.token}` },
            body
        });
        const started = await response.json();
        assert.equal(response.status, 202);
        const job = await waitForJob(base, started.jobId, created.payload.token);
        assert.equal(job.status, "completed");
        assert.equal(job.result.source, "photo");
        assert.equal(job.result.images.length, 2);
        assert.match(recorded.enhanceArgs.prompt, /green hoodie/);
        assert.equal(recorded.describeArgs.mimeType, "image/png");
        assert.equal(fs.readdirSync(path.join(dir, "uploads")).length, 1);

        const junk = new FormData();
        junk.append("photo", new Blob(["hello"], { type: "image/png" }), "notes.png");
        const rejected = await fetch(`${base}/avatar/transform`, { method: "POST", body: junk });
        assert.equal(rejected.status, 400);
    });
});

test("a restarted server keeps finished avatars and fails unfinished jobs", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "avatarforge-restart-"));
    try {
        fs.writeFileSync(path.join(dir, "db.json"), JSON.stringify({
            users: [],
            avatars: [],
            jobs: [{ id: "job-1", status: "processing", userId: null }]
        }));
        const store = createStore(dir);
        assert.equal(store.getJob("job-1").status, "failed");
        assert.equal(store.getJob("job-1").error.code, "INTERRUPTED");
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("legacy proxy returns generated bytes or a JSON error", async () => {
    await withApp({}, async ({ base }) => {
        const response = await fetch(`${base}/avatar/proxy-image?prompt=${encodeURIComponent("small avatar")}&seed=4`);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("content-type"), "image/png");
        assert.equal(detectImageType(Buffer.from(await response.arrayBuffer())).contentType, "image/png");
    });
    await withApp({
        imageGen: {
            async generate() {
                throw Object.assign(new Error("busy"), { code: "UPSTREAM" });
            }
        }
    }, async ({ base }) => {
        const response = await fetch(`${base}/avatar/proxy-image?prompt=avatar`);
        const payload = await response.json();
        assert.equal(response.status, 502);
        assert.equal(payload.error, "busy");
    });
});
