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

        const imageUrl =
            `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}`;

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

module.exports = router;
