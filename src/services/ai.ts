import OpenAI from 'openai';

export async function processBatchWithAI(
  apiKey: string,
  templateSchema: string[],
  rawBatch: any[]
): Promise<any[]> {
  
  // Note: Using OpenAI SDK but configured for xAI by default if they provide an xAI key,
  // or they can provide an OpenAI key. Standard format works for both.
  // The user uses xAI for batching but OpenAI api format is universally supported.
  
  const isGroq = apiKey.startsWith('gsk_');
  const isXAI = apiKey.startsWith('xoxb');
  
  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: isGroq ? 'https://api.groq.com/openai/v1' : (isXAI ? 'https://api.x.ai/v1' : 'https://api.openai.com/v1'),
    dangerouslyAllowBrowser: true 
  });

  const prompt = `
You are an expert data migration assistant.
Your task is to take a batch of raw supplier inventory data and convert it PERFECTLY into a specific target CSV schema.

**Target Schema Columns:**
${JSON.stringify(templateSchema, null, 2)}

**Rules:**
1. The output MUST be a JSON array of objects.
2. Every object MUST have exactly the keys defined in the Target Schema.
3. Infer the product category, type, model, and year from the raw data if it exists.
4. Clean and format prices as numbers.
5. Provide a short, clean title (e.g. "Brand - Model Year - Category").
6. Provide a long descriptive body HTML paragraph in the "Body (HTML)" column.
7. Return ONLY the valid JSON array. No markdown blocks, no think tags, no text. Just JSON.

**Raw Data Batch:**
${JSON.stringify(rawBatch, null, 2)}
`;

  try {
    const response = await client.chat.completions.create({
      model: isGroq ? 'llama-3.3-70b-versatile' : (isXAI ? 'grok-beta' : 'gpt-4o-mini'),
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      response_format: { type: "json_object" } 
    });

    const content = response.choices[0].message.content || '[]';
    // Clean up potential markdown wrapping if the AI ignored the rule
    const cleaned = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    
    // In rare cases the AI might nest the array inside an object
    let parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      // Find the first array value inside the object
      const arrays = Object.values(parsed).filter(val => Array.isArray(val));
      if (arrays.length > 0) {
        parsed = arrays[0];
      } else {
        parsed = [parsed]; // fallback
      }
    }
    
    return parsed;
  } catch (error) {
    console.error("AI API Error:", error);
    throw error;
  }
}
