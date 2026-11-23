const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const client = require("../frontend/avatar-client");

function jsonResponse(body, ok = true) {
    return {
        ok,
        status: ok ? 200 : 500,
        async json() {
            return body;
        }
    };
}

test("frontend client validates input, status, and private image URLs", () => {
    assert.deepEqual(client.validateGenerateInput({ prompt: "  ", photo: null, variations: 1 }), [
        "Enter a description or choose a photo."
    ]);
    assert.deepEqual(client.validateGenerateInput({ prompt: "pilot", photo: null, variations: 5 }), [
        "Choose between 1 and 4 variations."
    ]);
    assert.deepEqual(client.validateGenerateInput({ prompt: "", photo: { name: "me.png" }, variations: 2 }), []);

    assert.equal(client.statusText({ status: "queued", stage: "queued" }), "Queued…");
    assert.equal(
        client.statusText({ status: "processing", stage: "generating", progress: { completed: 1, total: 3 } }),
        "Generating variation 2 of 3…"
    );
    assert.equal(
        client.statusText({ status: "completed", warnings: [], result: { images: [{ id: "1" }, { id: "2" }] } }),
        "2 variations ready."
    );
    assert.equal(client.statusText({ status: "failed", error: { message: "Image service timed out." } }), "Image service timed out.");

    const url = client.withToken("/avatar/images/abc", "tok en", "http://localhost:5000");
    assert.equal(url, "http://localhost:5000/avatar/images/abc?access_token=tok%20en");
    assert.equal(client.authHeaders("tok")["Authorization"], "Bearer tok");
});

test("frontend polling stops when a job finishes", async () => {
    const seen = [];
    let calls = 0;
    const job = await client.pollJob("job-7", {
        base: "http://example.test",
        intervalMs: 0,
        sleep: async () => {},
        headers: { Authorization: "Bearer tok" },
        fetchImpl: async (url, options) => {
            calls += 1;
            assert.equal(url, "http://example.test/avatar/jobs/job-7");
            assert.equal(options.headers.Authorization, "Bearer tok");
            if (calls === 1) {
                return jsonResponse({ status: "processing", stage: "enhancing", progress: { completed: 0, total: 1 } });
            }
            return jsonResponse({ status: "completed", warnings: [], result: { images: [{ id: "1" }] } });
        },
        onUpdate: (update) => seen.push(update.status)
    });
    assert.deepEqual(seen, ["processing", "completed"]);
    assert.equal(job.status, "completed");
});

test("pages expose generation, photo upload, accounts, and history", () => {
    const root = path.join(__dirname, "..", "frontend");
    const ai = fs.readFileSync(path.join(root, "ai-generator.html"), "utf8");
    const manual = fs.readFileSync(path.join(root, "manual-generator.html"), "utf8");
    const signin = fs.readFileSync(path.join(root, "signin.html"), "utf8");
    const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
    const script = fs.readFileSync(path.join(root, "script.js"), "utf8");

    for (const marker of ["id=\"photo\"", "id=\"variations\"", "id=\"enhance\"", "id=\"status\"", "id=\"error\"", "id=\"history\"", "avatar-client.js"]) {
        assert.match(ai, new RegExp(marker));
    }
    assert.match(manual, /id="manual-variations"/);
    assert.match(manual, /id="manual-generate-btn"/);
    assert.match(manual, /id="manual-error"/);
    assert.match(signin, /id="auth-form"/);
    assert.match(signin, /id="register-btn"/);
    assert.doesNotMatch(signin, /identity\.ic0\.app/);
    assert.doesNotMatch(home, /Internet Identity/);
    assert.match(script, /\/avatar\/transform/);
    assert.match(script, /\/avatar\/history/);
    assert.match(script, /AvatarClient\.pollJob/);
});

test("generator UI reports an empty prompt without calling the server", async () => {
    const elements = {};
    const listeners = new Map();
    function makeElement(id) {
        const classes = new Set();
        const elementListeners = {};
        const element = {
            id,
            value: "",
            checked: true,
            textContent: "",
            innerHTML: "",
            disabled: false,
            files: [],
            className: "",
            onclick: null,
            classList: {
                add(name) { classes.add(name); },
                remove(name) { classes.delete(name); },
                contains(name) { return classes.has(name); },
                toggle(name, force) {
                    const on = force == null ? !classes.has(name) : Boolean(force);
                    if (on) classes.add(name);
                    else classes.delete(name);
                }
            },
            addEventListener(type, fn) {
                elementListeners[type] = elementListeners[type] || [];
                elementListeners[type].push(fn);
            },
            click() {
                if (element.onclick) element.onclick();
                (elementListeners.click || []).forEach((fn) => fn());
            },
            append() {}
        };
        if (id) elements[id] = element;
        return element;
    }

    const attrs = {};
    const storage = new Map();
    global.window = global;
    global.localStorage = {
        getItem: (key) => storage.has(key) ? storage.get(key) : null,
        setItem: (key, value) => storage.set(key, String(value)),
        removeItem: (key) => storage.delete(key)
    };
    global.location = { protocol: "http:", origin: "http://localhost:5000", href: "http://localhost:5000/ai-generator.html" };
    global.matchMedia = () => ({ matches: false });
    global.document = {
        documentElement: {
            setAttribute: (key, value) => { attrs[key] = value; },
            getAttribute: (key) => attrs[key] || null
        },
        addEventListener: (type, fn) => listeners.set(type, fn),
        getElementById: (id) => elements[id] || null,
        createElement: () => makeElement("")
    };

    ["theme-toggle", "moon-icon", "sun-icon", "signin-btn", "prompt", "style", "variations", "enhance", "photo", "status", "error", "gallery", "generate-btn", "history", "enhanced"].forEach((id) => makeElement(id));
    elements.style.value = "Anime";
    elements.variations.value = "1";
    elements.error.classList.add("hidden");

    let fetches = 0;
    global.fetch = async () => {
        fetches += 1;
        throw new Error("fetch should not run");
    };

    require("../frontend/script");
    listeners.get("DOMContentLoaded")();

    assert.equal(attrs["data-theme"], "light");
    elements["theme-toggle"].click();
    assert.equal(attrs["data-theme"], "dark");
    assert.equal(localStorage.getItem("avatarforge_theme"), "dark");

    assert.equal(elements["signin-btn"].textContent, "Sign In");
    elements["signin-btn"].click();
    assert.equal(location.href, "signin.html");

    elements["generate-btn"].click();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(fetches, 0);
    assert.match(elements.error.textContent, /description or choose a photo/i);
    assert.equal(elements.error.classList.contains("hidden"), false);
    assert.match(elements.history.innerHTML, /Sign in/);
});
