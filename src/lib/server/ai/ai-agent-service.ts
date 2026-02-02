import axios from 'axios';

/**
 * AI Agent Service - Uses DigitalOcean AI Agent for intelligent comment analysis
 */
export class AIAgentService {
    private agentEndpoint = 'https://gbmiivqntj3sxq47vilt4vrm.agents.do-ai.run/api/v1/chat/completions';
    private agentApiKey = '59-YL1fT42UDydTfmpoahl9ksSbQNmDs';
    private modelEndpoint = 'https://inference.do-ai.run/v1/chat/completions';
    private modelApiKey = 'sk-do-Cxvk4fVAr5b41kd7U_ilLIX1RcblRFmPPyQMfUvfmqfFirTlAZdTLGvMi5';

    /**
     * Score a batch of comments using AI agent
     */
    async scoreComments(comments: Array<{ username: string; text: string }>) {
        const prompt = `You are analyzing Instagram comments on real estate posts to identify potential buyers.

Score each comment from 0-100 based on buyer intent. Return ONLY a JSON array.

HIGH INTENT (70-100): price, fiyat, how much, interested, details, location, dm me, whatsapp, still available, contact, buy, rent
MEDIUM INTENT (40-69): beautiful, nice, wow, amazing, love it
REJECT (0): emoji-only, tag-only, bot spam, negative sentiment

Comments to analyze:
${comments.map((c, i) => `${i}. @${c.username}: "${c.text}"`).join('\n')}

Return format: [{"index": 0, "score": 85, "reason": "explicit price inquiry"}, ...]`;

        try {
            const response = await axios.post(
                this.agentEndpoint,
                {
                    messages: [{ role: 'user', content: prompt }],
                    stream: false,
                    include_functions_info: true,
                    include_retrieval_info: true,
                    include_guardrails_info: true
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.agentApiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const content = response.data.choices?.[0]?.message?.content || '[]';
            const scores = JSON.parse(content.replace(/```json?/g, '').replace(/```/g, ''));

            return scores;
        } catch (error) {
            console.error('[AI Agent] Scoring failed:', error);
            // Fallback to simple keyword matching
            return this.fallbackScoring(comments);
        }
    }

    /**
     * Fallback scoring without AI
     */
    private fallbackScoring(comments: Array<{ username: string; text: string }>) {
        const highIntentKeywords = ['price', 'fiyat', 'how much', 'interested', 'details', 'location', 'dm', 'whatsapp', 'available', 'contact'];

        return comments.map((comment, index) => {
            const text = comment.text.toLowerCase();
            const hasHighIntent = highIntentKeywords.some(kw => text.includes(kw));

            return {
                index,
                score: hasHighIntent ? 75 : 30,
                reason: hasHighIntent ? 'keyword match' : 'no intent keywords'
            };
        });
    }

    /**
     * Analyze a single comment deeply
     */
    async analyzeComment(comment: string, postCaption: string) {
        const prompt = `Analyze this Instagram comment on a real estate post for genuine buyer intent.

Post: "${postCaption?.substring(0, 100) || 'Real estate listing'}"
Comment: "${comment}"

Return JSON: {"score": 0-100, "isBuyer": boolean, "reason": "explanation"}`;

        try {
            const response = await axios.post(
                this.modelEndpoint,
                {
                    model: 'openai-gpt-oss-20b',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 100
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.modelApiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const content = response.data.choices?.[0]?.message?.content || '{"score": 0, "isBuyer": false}';
            return JSON.parse(content.replace(/```json?/g, '').replace(/```/g, ''));
        } catch (error) {
            console.error('[AI Agent] Analysis failed:', error);
            return { score: 0, isBuyer: false, reason: 'analysis failed' };
        }
    }
}
