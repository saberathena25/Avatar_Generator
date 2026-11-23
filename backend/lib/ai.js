const OpenAI = require("openai");

const DEFAULT_TEXT_MODEL = "qwen/qwen3.8-27b";
const DEFAULT_VISION_MODEL = "qwen/qwen3.8-27b";

function localEnhance(prompt, style) {
    return [
        `Square avatar portrait, ${style} style`,
        "single centered character, clean simple background, crisp facial features",
        String(prompt || "").trim()
    ].filter(Boolean).join(". ").slice(0, 800);
}

function stripModelNoise(text) {
    return String(text || "")
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .replace(/^["'`]+|["'`]+$/g, "")
        .trim();
}

function createAi(options = {}) {
    const apiKey = options.apiKey !== undefined ? options.apiKey : process.env.GROQ_API_KEY;
    const textModel = options.textModel || process.env.GROQ_TEXT_MODEL || DEFAULT_TEXT_MODEL;
    const visionModel = options.visionModel || process.env.GROQ_VISION_MODEL || DEFAULT_VISION_MODEL;
    const client = options.client || (apiKey
        ? new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" })
        : null);

    async function complete(model, messages) {
        const completion = await client.chat.completions.create({
            model,
            temperature: 0.4,
            max_tokens: 400,
            messages
        });
        return stripModelNoise(completion.choices?.[0]?.message?.content);
    }

    return {
        textModel,
        visionModel,
        async enhance(prompt, style) {
            const fallback = localEnhance(prompt, style);
            if (!client) {
                return {
                    prompt: fallback,
                    source: "local",
                    warning: "GROQ_API_KEY is not configured, so a local prompt template was used."
                };
            }
            try {
                const text = await complete(textModel, [
                    {
                        role: "system",
                        content: "You write one image-generation prompt for a square avatar portrait. Return only the prompt. No title, quotes, or markdown. Keep it under 600 characters. The subject must be centered with a simple background."
                    },
                    {
                        role: "user",
                        content: `Style: ${style}\nDescription: ${prompt}`
                    }
                ]);
                if (!text) throw new Error("The language model returned an empty prompt.");
                return { prompt: text.slice(0, 800), source: "groq", warning: null };
            } catch (error) {
                return {
                    prompt: fallback,
                    source: "local",
                    warning: "Prompt enhancement fell back to a local template because the language model was unavailable."
                };
            }
        },
        async describePhoto(buffer, mimeType, style, userPrompt) {
            if (!client) {
                const error = new Error("Photo transformation needs GROQ_API_KEY so the photo can be described.");
                error.code = "VISION_FAILED";
                throw error;
            }
            try {
                const text = await complete(visionModel, [
                    {
                        role: "system",
                        content: "Describe a photo so an image model can draw a stylized avatar of the same person. Reply with one paragraph of visible traits: hair, expression, clothing colors, accessories, and framing. Do not include a real name or identify the person. Do not refuse an ordinary portrait."
                    },
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: `Style: ${style}. Extra direction: ${userPrompt || "none"}.`
                            },
                            {
                                type: "image_url",
                                image_url: { url: `data:${mimeType};base64,${buffer.toString("base64")}` }
                            }
                        ]
                    }
                ]);
                if (!text) throw new Error("empty description");
                return text.slice(0, 800);
            } catch (error) {
                const wrapped = new Error("Could not read the photo. Try a clearer PNG or JPEG portrait.");
                wrapped.code = "VISION_FAILED";
                throw wrapped;
            }
        }
    };
}

module.exports = { createAi, localEnhance, DEFAULT_TEXT_MODEL, DEFAULT_VISION_MODEL };
