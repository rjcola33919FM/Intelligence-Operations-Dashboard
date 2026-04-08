import OpenAI from "openai";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const MAX_MESSAGE_LENGTH = 2000;

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { ok: false, error: "OPENAI_API_KEY is missing" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const message = body?.message;
    const agent = body?.agent;
    const history = Array.isArray(body?.history) ? body.history : [];

    if (!message || typeof message !== "string") {
      return Response.json(
        { ok: false, error: "A valid message is required" },
        { status: 400 }
      );
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return Response.json(
        { ok: false, error: "Message exceeds maximum allowed length" },
        { status: 400 }
      );
    }

    const client = new OpenAI({ apiKey });

    const systemPrompt =
      agent === "realEstate"
        ? "You are a Real Estate Intelligence Assistant. You must retain and use all previously provided property details in the conversation. If the user provides an address once, do NOT ask for it again. If clarification is needed, ask ONE question, then proceed using known data."
        : agent === "dataAnalyst"
        ? "You are DataAnalystGPT. Provide structured, factual, analytical responses only. If data is missing, respond with: INSUFFICIENT DATA: followed by exactly what is missing."
        : agent === "matterMaps"
        ? "You are Matter Maps, a legal strategy AI. Structure problems, map relationships, and identify risks clearly."
        : "You are ISLT, a course creation AI. Build structured learning systems and step-by-step frameworks.";

    const input = [
      {
        role: "system" as const,
        content: systemPrompt,
      },
      ...history.map((m: ChatMessage) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      temperature: 0.1,
      input,
    });

    return Response.json({
      ok: true,
      reply: response.output_text,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return Response.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
