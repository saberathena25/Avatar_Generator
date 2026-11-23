function detectImageType(buffer) {
    if (!buffer || buffer.length < 12) return null;
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return { ext: ".jpg", contentType: "image/jpeg" };
    }
    if (buffer[0] === 0x89 && buffer.toString("ascii", 1, 4) === "PNG") {
        return { ext: ".png", contentType: "image/png" };
    }
    if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
        return { ext: ".webp", contentType: "image/webp" };
    }
    if (buffer.toString("ascii", 0, 6) === "GIF87a" || buffer.toString("ascii", 0, 6) === "GIF89a") {
        return { ext: ".gif", contentType: "image/gif" };
    }
    return null;
}

function buildImageRequests({ prompt, seed, apiKey }) {
    const encoded = encodeURIComponent(prompt);
    const headers = { Accept: "image/jpeg,image/png,image/webp", "User-Agent": "AvatarForge/1.0" };
    const requests = [];
    if (apiKey) {
        requests.push({
            provider: "pollinations",
            url: `https://gen.pollinations.ai/image/${encoded}?model=${encodeURIComponent("black-forest-labs/flux.1-schnell")}&width=512&height=512&seed=${seed}&nologo=true`,
            headers: { ...headers, Authorization: `Bearer ${apiKey}` }
        });
    }
    requests.push({
        provider: "pollinations-legacy",
        url: `https://image.pollinations.ai/prompt/${encoded}?width=512&height=512&nologo=true&seed=${seed}&model=flux`,
        headers
    });
    return requests;
}

function messageFromBody(buffer, status) {
    const text = buffer.toString("utf8").slice(0, 400);
    try {
        const json = JSON.parse(text);
        const message = json.error?.message || json.message || json.error;
        if (typeof message === "string" && message.trim()) return message.trim();
    } catch {
        // Response was not JSON.
    }
    if (!text || text.startsWith("<") || text.startsWith("{")) {
        return `Image service returned ${status}.`;
    }
    return text.replace(/\s+/g, " ").trim();
}

async function generateImage({ prompt, seed, apiKey, fetchImpl = fetch }) {
    const key = apiKey !== undefined ? apiKey : process.env.POLLINATIONS_API_KEY;
    const requests = buildImageRequests({ prompt, seed, apiKey: key || "" });
    let lastMessage = "Image service did not return an image.";

    for (const request of requests) {
        try {
            const response = await fetchImpl(request.url, {
                headers: request.headers,
                signal: AbortSignal.timeout(90000)
            });
            const buffer = Buffer.from(await response.arrayBuffer());
            const type = detectImageType(buffer);
            if (response.ok && type) {
                return { buffer, contentType: type.contentType, ext: type.ext, provider: request.provider };
            }
            lastMessage = messageFromBody(buffer, response.status);
        } catch (error) {
            lastMessage = error.name === "TimeoutError"
                ? "Image service timed out."
                : "Image service could not be reached.";
        }
    }

    const error = new Error(lastMessage);
    error.code = "UPSTREAM";
    throw error;
}

module.exports = { detectImageType, buildImageRequests, generateImage };
