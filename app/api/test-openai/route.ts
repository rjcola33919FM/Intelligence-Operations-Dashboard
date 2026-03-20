import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET() {
  return Response.json({
    ok: true,
    message: "chat route is working",
  });
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { ok: false, error: "OPENAI_API_KEY is missing" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const message = body?.message;

    if (!message || typeof message !== "string") {
      return Response.json(
        { ok: false, error: "message is required" },
        { status: 400 }
      );
    }

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: `Reply in this exact format:
[RESULT]
<short answer>

User question: ${message}`,
    });

    return Response.json({
      ok: true,
      output_text: response.output_text || "[RESULT]\nINSUFFICIENT DATA",
    });
  } catch (error: any) {
    return Response.json(
      { ok: false, error: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}