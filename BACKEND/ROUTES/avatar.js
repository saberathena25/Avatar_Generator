const express = require("express");
const router = express.Router();

router.post("/generate", async (req, res) => {

    const { prompt, style } = req.body;

    const enhancedPrompt =
        `${style} avatar portrait, ${prompt}`;

        const imageUrl =
        `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}`;

    res.json({
        prompt: enhancedPrompt,
        image:
        "https://placehold.co/512x512"
    });
});

module.exports = router;
