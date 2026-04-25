import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });

export async function POST(req: NextRequest) {
  try {
    const { image, text } = await req.json();

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: "GROQ_API_KEY is not configured" }, { status: 500 });
    }

    const prompt = `
      You are an expert waste classification and climate impact analyst.
      Identify the waste item based on the text or image.
      Classify it into one of the following bins:
      - 'red' (Hazardous/E-waste/Medical)
      - 'blue' (Recyclable - plastic, glass, metal, paper)
      - 'green' (Compostable/Organic - food, yard waste)
      - 'grey' (Landfill/General if none of the above apply)
      
      Also provide climate impact estimates if this item is disposed of correctly vs incorrectly. Provide:
      - reducedEmissions: an estimated integer percentage (0-100) of CO2 emissions reduced by recycling/composting this instead of landfilling.
      - resourceSaved: a short string describing the resources saved.
      - climateEffect: a short string describing the broader climate effect of correct disposal.
      
      Respond STRICTLY with valid JSON matching this schema, nothing else:
      {
        "bin": "red" | "blue" | "green" | "grey",
        "reasoning": "A short explanation of why it goes in this bin",
        "impact": {
          "reducedEmissions": number,
          "resourceSaved": "string",
          "climateEffect": "string"
        }
      }
    `;

    let modelName = "llama-3.3-70b-versatile";
    let content: any = [];

    if (text) {
      content.push({ type: "text", text: `User text: ${text}` });
    }
    
    if (image) {
      modelName = "llama-3.2-11b-vision-preview";
      content.push({
        type: "image_url",
        image_url: {
          url: image
        }
      });
    }

    content.push({ type: "text", text: prompt });

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: content,
        },
      ],
      model: modelName,
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const textResponse = completion.choices[0]?.message?.content || "";
    const data = JSON.parse(textResponse);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error classifying waste with Groq:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
