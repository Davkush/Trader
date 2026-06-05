import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post("/api/chat", async (req, res) => {
    try {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "OPENROUTER_API_KEY is not configured on the server." });
      }

      const { messages, model } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Invalid messages array." });
      }

      const targetModel = model || "meta-llama/llama-3.1-8b-instruct:free";

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://ai.studio/build", // Optional, for including your app on openrouter.ai rankings.
          "X-Title": "AI Studio Quant App", // Optional. Shows in rankings on openrouter.ai.
        },
        body: JSON.stringify({
          model: targetModel,
          messages: messages,
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("OpenRouter Error:", errText);
        return res.status(response.status).json({ error: `OpenRouter API error: ${response.status} ${errText}` });
      }

      const data = await response.json();
      res.json(data);
    } catch (err: any) {
      console.error("/api/chat Error:", err);
      res.status(500).json({ error: "Internal server error connecting to OpenRouter." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
