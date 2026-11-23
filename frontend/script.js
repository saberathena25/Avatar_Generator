document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initAuth();
    initSignInForm();
    initGenerator();
    initManualGenerator();
    loadHistory();
});

function initTheme() {
    const savedTheme = localStorage.getItem("avatarforge_theme");
    if (savedTheme === "dark" || savedTheme === "light") {
        document.documentElement.setAttribute("data-theme", savedTheme);
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.documentElement.setAttribute("data-theme", "dark");
    } else {
        document.documentElement.setAttribute("data-theme", "light");
    }
    updateThemeIcons();

    const toggleBtn = document.getElementById("theme-toggle");
    if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
            const currentTheme = document.documentElement.getAttribute("data-theme");
            const newTheme = currentTheme === "dark" ? "light" : "dark";
            document.documentElement.setAttribute("data-theme", newTheme);
            localStorage.setItem("avatarforge_theme", newTheme);
            updateThemeIcons();
        });
    }
}

function updateThemeIcons() {
    const moonIcon = document.getElementById("moon-icon");
    const sunIcon = document.getElementById("sun-icon");
    if (!moonIcon || !sunIcon) return;
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    moonIcon.classList.toggle("hidden", dark);
    sunIcon.classList.toggle("hidden", !dark);
}

function currentToken() {
    return localStorage.getItem("avatarforge_token");
}

function currentUser() {
    try {
        return JSON.parse(localStorage.getItem("avatarforge_user") || "null");
    } catch {
        return null;
    }
}

function initAuth() {
    const signinBtn = document.getElementById("signin-btn");
    if (!signinBtn) return;
    const user = currentUser();
    if (currentToken() && user) {
        signinBtn.textContent = "Sign Out";
        signinBtn.classList.remove("btn-primary");
        signinBtn.classList.add("btn-secondary");
        signinBtn.onclick = () => {
            localStorage.removeItem("avatarforge_token");
            localStorage.removeItem("avatarforge_user");
            localStorage.removeItem("avatarforge_principal");
            window.location.reload();
        };
    } else {
        signinBtn.textContent = "Sign In";
        signinBtn.classList.add("btn-primary");
        signinBtn.classList.remove("btn-secondary");
        signinBtn.onclick = () => {
            window.location.href = "signin.html";
        };
    }
}

function showMessage(element, message) {
    if (!element) return;
    element.textContent = message;
    element.classList.remove("hidden");
}

function hideMessage(element) {
    if (!element) return;
    element.textContent = "";
    element.classList.add("hidden");
}

function renderImages(gallery, images, token) {
    gallery.innerHTML = "";
    images.forEach((image, index) => {
        const figure = document.createElement("figure");
        figure.className = "shot";
        const img = document.createElement("img");
        img.alt = `Avatar variation ${index + 1}`;
        img.src = AvatarClient.withToken(image.url, token);
        const link = document.createElement("a");
        link.className = "btn btn-secondary btn-sm";
        link.href = img.src;
        link.download = `avatar-${index + 1}.png`;
        link.textContent = "Download";
        figure.append(img, link);
        gallery.append(figure);
    });
}

async function runGeneration(options) {
    const prompt = options.prompt.trim();
    const photo = options.photo || null;
    const variations = options.variations;
    const errors = AvatarClient.validateGenerateInput({ prompt, photo, variations });
    hideMessage(options.errorEl);
    if (errors.length) {
        showMessage(options.errorEl, errors[0]);
        return;
    }

    if (options.button) options.button.disabled = true;
    if (options.gallery) options.gallery.innerHTML = "";
    hideMessage(options.enhancedEl);
    showMessage(options.statusEl, "Queued…");

    const token = currentToken();
    try {
        let response;
        if (photo) {
            const body = new FormData();
            body.append("photo", photo);
            body.append("prompt", prompt);
            body.append("style", options.style);
            body.append("variations", String(variations));
            body.append("enhance", options.enhance ? "true" : "false");
            response = await fetch(`${AvatarClient.apiBase()}/avatar/transform`, {
                method: "POST",
                headers: AvatarClient.authHeaders(token),
                body
            });
        } else {
            response = await fetch(`${AvatarClient.apiBase()}/avatar/generate`, {
                method: "POST",
                headers: AvatarClient.authHeaders(token, { "Content-Type": "application/json" }),
                body: JSON.stringify({
                    prompt,
                    style: options.style,
                    variations: Number(variations),
                    enhance: options.enhance,
                    source: options.source || "text"
                })
            });
        }

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Could not start generation.");

        const job = await AvatarClient.pollJob(payload.jobId, {
            headers: AvatarClient.authHeaders(token),
            onUpdate: (update) => showMessage(options.statusEl, AvatarClient.statusText(update))
        });
        showMessage(options.statusEl, AvatarClient.statusText(job));
        if (job.status === "failed") {
            showMessage(options.errorEl, job.error?.message || "Generation failed.");
            return;
        }
        if (options.enhancedEl && job.result?.enhancedPrompt) {
            const how = job.result.enhancementSource === "groq" ? "Enhanced prompt" : "Prompt";
            showMessage(options.enhancedEl, `${how}: ${job.result.enhancedPrompt}`);
        }
        if (options.gallery) renderImages(options.gallery, job.result.images, token);
        await loadHistory();
    } catch (error) {
        showMessage(options.errorEl, error.message || "Generation failed.");
        showMessage(options.statusEl, "Generation failed.");
    } finally {
        if (options.button) options.button.disabled = false;
    }
}

function initGenerator() {
    const button = document.getElementById("generate-btn");
    if (!button) return;
    button.addEventListener("click", () => {
        const photoInput = document.getElementById("photo");
        runGeneration({
            prompt: document.getElementById("prompt").value,
            style: document.getElementById("style").value,
            variations: document.getElementById("variations").value,
            enhance: document.getElementById("enhance").checked,
            photo: photoInput.files && photoInput.files[0] ? photoInput.files[0] : null,
            source: "text",
            statusEl: document.getElementById("status"),
            errorEl: document.getElementById("error"),
            galleryEl: document.getElementById("gallery"),
            enhancedEl: document.getElementById("enhanced"),
            button
        });
    });
}

function initManualGenerator() {
    const button = document.getElementById("manual-generate-btn");
    if (!button) return;
    button.addEventListener("click", () => {
        const gender = document.getElementById("manual-gender").value;
        const style = document.getElementById("manual-style").value;
        const prompt = [
            `Portrait avatar of a ${gender}`,
            `hair ${document.getElementById("manual-top").value}`,
            `hair color ${document.getElementById("manual-haircolor").value}`,
            `accessories ${document.getElementById("manual-accessories").value}`,
            `facial hair ${document.getElementById("manual-facialhair").value}`,
            `clothing ${document.getElementById("manual-clothes").value}`,
            `eyes ${document.getElementById("manual-eyes").value}`,
            `eyebrows ${document.getElementById("manual-eyebrow").value}`,
            `mouth ${document.getElementById("manual-mouth").value}`,
            `skin ${document.getElementById("manual-skin").value}`,
            `${style} framing, centered, clean background`
        ].join(", ");
        runGeneration({
            prompt,
            style,
            variations: document.getElementById("manual-variations").value,
            enhance: document.getElementById("manual-enhance").checked,
            photo: null,
            source: "manual",
            statusEl: document.getElementById("manual-status"),
            errorEl: document.getElementById("manual-error"),
            galleryEl: document.getElementById("manual-gallery"),
            enhancedEl: document.getElementById("manual-enhanced"),
            button
        });
    });
}

async function loadHistory() {
    const history = document.getElementById("history");
    if (!history) return;
    const token = currentToken();
    if (!token) {
        history.innerHTML = "<p class=\"placeholder-text\">Sign in to keep a private avatar history on this server.</p>";
        return;
    }
    try {
        const response = await fetch(`${AvatarClient.apiBase()}/avatar/history`, {
            headers: AvatarClient.authHeaders(token)
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Could not load history.");
        history.innerHTML = "";
        if (!payload.avatars.length) {
            history.innerHTML = "<p class=\"placeholder-text\">No saved avatars yet.</p>";
            return;
        }
        payload.avatars.forEach((avatar) => {
            const card = document.createElement("article");
            card.className = "history-card";
            const title = document.createElement("p");
            title.className = "history-meta";
            title.textContent = `${avatar.style} · ${avatar.source}`;
            card.append(title);
            const gallery = document.createElement("div");
            gallery.className = "gallery";
            renderImages(gallery, avatar.images, token);
            card.append(gallery);
            history.append(card);
        });
    } catch (error) {
        history.innerHTML = `<p class="placeholder-text">${error.message}</p>`;
    }
}

function initSignInForm() {
    const form = document.getElementById("auth-form");
    if (!form) return;
    const errorEl = document.getElementById("auth-error");
    const session = document.getElementById("auth-session");
    const user = currentUser();
    if (currentToken() && user && session) {
        session.textContent = `Signed in as ${user.username}.`;
        session.classList.remove("hidden");
    }

    async function submit(path) {
        hideMessage(errorEl);
        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value;
        try {
            const response = await fetch(`${AvatarClient.apiBase()}${path}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || "Could not sign in.");
            localStorage.setItem("avatarforge_token", payload.token);
            localStorage.setItem("avatarforge_user", JSON.stringify(payload.user));
            window.location.href = "ai-generator.html";
        } catch (error) {
            showMessage(errorEl, error.message);
        }
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        submit("/auth/login");
    });
    document.getElementById("register-btn").addEventListener("click", () => submit("/auth/register"));
}
