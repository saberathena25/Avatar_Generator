const express = require("express");
const OpenAI = require("openai");

const router = express.Router();

const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
});

router.post("/generate", async (req, res) => {
    try {
        const { prompt, style } = req.body;

        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "user",
                    content: `Create a highly detailed avatar image prompt for:
                    Style: ${style}
                    Description: ${prompt}`
                }
            ]
        });

        const enhancedPrompt =
            completion.choices[0].message.content;

        // Return a proxy URL pointing to our own backend instead of pollinations directly
        const imageUrl = `http://localhost:5000/avatar/proxy-image?prompt=${encodeURIComponent(enhancedPrompt)}`;

        res.json({
            prompt: enhancedPrompt,
            image: imageUrl
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Failed to generate avatar"
        });
    }
});

router.get("/proxy-image", async (req, res) => {
    try {
        const { prompt } = req.query;
        if (!prompt) return res.status(400).send("Prompt required");
        
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true`;
        
        const response = await fetch(pollinationsUrl);
        if (!response.ok) throw new Error(`Pollinations API error: ${response.status}`);
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.setHeader("Content-Type", "image/jpeg");
    
        res.send(buffer);
    } catch (error) {
        console.error("Proxy error:", error);
        res.status(500).send("Error proxying image");
    }
});

module.exports = router;
