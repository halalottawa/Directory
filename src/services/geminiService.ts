import { GoogleGenAI, Type } from "@google/genai";
import { Event } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const fetchRecentEvents = async (): Promise<Event[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Find 5 recent or upcoming community events in the USA for the year 2026. Provide them in a structured format.",
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              organizer: { type: Type.STRING },
              location: { type: Type.STRING },
              dateTime: { type: Type.STRING, description: "ISO 8601 format" },
              coverImage: { type: Type.STRING, description: "A relevant image URL from Unsplash or similar" },
              isFeatured: { type: Type.BOOLEAN },
              isApproved: { type: Type.BOOLEAN },
              createdAt: { type: Type.STRING },
              submittedBy: { type: Type.STRING }
            },
            required: ["id", "title", "description", "organizer", "location", "dateTime", "coverImage"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    
    const events = JSON.parse(text) as Event[];
    return events.map(event => ({
      ...event,
      isApproved: true,
      isFeatured: event.isFeatured || false,
      createdAt: event.createdAt || new Date().toISOString(),
      submittedBy: event.submittedBy || 'system',
      lat: event.lat || 0,
      lng: event.lng || 0
    }));
  } catch (error) {
    console.error("Error fetching recent events:", error);
    return [];
  }
};
