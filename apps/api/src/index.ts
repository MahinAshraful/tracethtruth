export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    
    // Handle OPTIONS for CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Root path - welcome message
    if (url.pathname === "/") {
      return new Response(JSON.stringify({
        name: "TraceTheTruth API",
        version: "1.0.0",
        status: "online",
        endpoints: {
          health: "/api/health",
          analyze: "/api/analyze (POST)",
        },
        documentation: "https://github.com/yourusername/tracethtruth",
        poweredBy: "Google DeepMind Gemini × Cloudflare Workers"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // Health check endpoint
    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({
        status: "healthy",
        message: "TraceTheTruth API is running!",
        timestamp: new Date().toISOString(),
        hasGeminiKey: !!env.GEMINI_API_KEY,
        environment: env.ENVIRONMENT || "development"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // Analysis endpoint
    if (url.pathname === "/api/analyze" && request.method === "POST") {
      try {
        const body = await request.json();
        const { content } = body;
        
        if (!content) {
          return new Response(JSON.stringify({
            success: false,
            error: "Content is required"
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        
        // Call Gemini API
        const geminiResponse = await fetch(
          `${env.GEMINI_API_ENDPOINT}/models/gemini-pro:generateContent?key=${env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `Analyze this content for potential misinformation, provide a verdict (true/false/mixed), confidence score, and brief explanation: "${content}"`
                }]
              }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024
              }
            })
          }
        );
        
        if (!geminiResponse.ok) {
          const error = await geminiResponse.text();
          throw new Error(`Gemini API error: ${error}`);
        }
        
        const geminiData = await geminiResponse.json();
        const analysisText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "Unable to analyze";
        
        // Return structured response
        return new Response(JSON.stringify({
          success: true,
          data: {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            content: content.substring(0, 100) + "...",
            analysis: analysisText,
            verdict: {
              classification: analysisText.toLowerCase().includes("false") ? "likely_false" : 
                             analysisText.toLowerCase().includes("true") ? "likely_true" : "mixed",
              explanation: analysisText
            }
          }
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
        
      } catch (error) {
        console.error("Analysis error:", error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message || "Analysis failed"
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }
    
    // 404 for unknown paths
    return new Response(JSON.stringify({
      error: "Not Found",
      message: `Path ${url.pathname} not found`,
      availableEndpoints: ["/", "/api/health", "/api/analyze"]
    }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};
