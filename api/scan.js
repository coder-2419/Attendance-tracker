import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const { imageBase64, mimeType } = req.body;
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-pro-latest",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      You are an academic calendar extraction system. Analyze this calendar image. 
      Return ONLY a raw JSON object with the following exact structure:
      {
        "startDate": "YYYY-MM-DD",
        "endDate": "YYYY-MM-DD",
        "holidays": ["YYYY-MM-DD", "YYYY-MM-DD"],
        "importantDates": ["YYYY-MM-DD"]
      }
      Do not include markdown blocks, just the raw JSON.
    `;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: imageBase64, mimeType } }
    ]);

    const jsonText = result.response.text();
    res.status(200).json(JSON.parse(jsonText));

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to process calendar' });
  }
}