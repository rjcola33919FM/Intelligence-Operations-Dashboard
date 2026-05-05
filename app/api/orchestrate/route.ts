import OpenAI from "openai";
import { AGENTS, ORCHESTRATOR_SYSTEM_PROMPT, type AgentKey } from "@/app/lib/agents";

const MAX_TASK_LENGTH = 4000;
const MAX_TOOL_ITERATIONS = 8;

export interface AgentCall {
  agent: AgentKey;
  task: string;
  context?: string;
  response: string;
}

async function callAgent(
  client: OpenAI,
  agentKey: AgentKey,
  task: string,
  context?: string
): Promise<string> {
  const agent = AGENTS[agentKey];

  const userMessage = context
    ? `Context from other agents:\n${context}\n\n---\nYour task:\n${task}`
    : task;

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    temperature: 0.1,
    input: [
      { role: "system", content: agent.systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  return response.output_text;
}

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
    const task: string = body?.task;
    const selectedAgents: AgentKey[] | undefined = body?.selectedAgents;

    if (!task || typeof task !== "string") {
      return Response.json(
        { ok: false, error: "A valid task is required" },
        { status: 400 }
      );
    }

    if (task.length > MAX_TASK_LENGTH) {
      return Response.json(
        { ok: false, error: "Task exceeds maximum allowed length" },
        { status: 400 }
      );
    }

    const client = new OpenAI({ apiKey });

    // ── Manual agent selection: skip orchestrator, run chosen agents in order ──
    if (selectedAgents && selectedAgents.length > 0) {
      const validKeys = selectedAgents.filter((k) => k in AGENTS);
      const agentCalls: AgentCall[] = [];
      let context = "";

      for (const key of validKeys) {
        const response = await callAgent(client, key, task, context || undefined);
        agentCalls.push({ agent: key, task, context: context || undefined, response });
        context += `\n\n=== ${AGENTS[key].name} ===\n${response}`;
      }

      // Build synthesis from collected outputs
      let finalSynthesis = "";
      if (agentCalls.length > 0) {
        const agentSummaryBlock = agentCalls
          .map((call) => `=== ${AGENTS[call.agent].name} ===\n${call.response}`)
          .join("\n\n");

        const synthesisResponse = await client.responses.create({
          model: "gpt-4.1-mini",
          temperature: 0.2,
          instructions: ORCHESTRATOR_SYSTEM_PROMPT,
          input: [
            { role: "user", content: task },
            {
              role: "user",
              content:
                `Here are all agent responses:\n\n${agentSummaryBlock}\n\n` +
                `Write your final synthesis using EXACTLY this structure:\n\n` +
                agentCalls
                  .map((call) => `## ${AGENTS[call.agent].name}\n<summary of this agent's contribution>`)
                  .join("\n\n") +
                `\n\n## Summary\n<2-3 sentence cross-agent conclusion>`,
            },
          ],
        });

        const textOutput = synthesisResponse.output.find(
          (item): item is OpenAI.Responses.ResponseOutputMessage => item.type === "message"
        );
        finalSynthesis =
          textOutput?.content
            .filter((c): c is OpenAI.Responses.ResponseOutputText => c.type === "output_text")
            .map((c) => c.text)
            .join("") ?? "";
      }

      return Response.json({ ok: true, agentCalls, synthesis: finalSynthesis });
    }

    // Tool definition: orchestrator calls this to invoke an agent
    const tools: OpenAI.Responses.Tool[] = [
      {
        type: "function",
        name: "call_agent",
        description:
          "Invoke a specialized agent to handle part of the task. Pass any relevant context from previous agent responses.",
        parameters: {
          type: "object",
          properties: {
            agent: {
              type: "string",
              enum: Object.keys(AGENTS),
              description: "Which agent to call",
            },
            task: {
              type: "string",
              description:
                "The specific question or sub-task for this agent. Be precise.",
            },
            context: {
              type: "string",
              description:
                "Relevant outputs from previous agents that this agent should consider. Leave empty if this is the first agent call.",
            },
          },
          required: ["agent", "task", "context"],
          additionalProperties: false,
        },
        strict: true,
      },
    ];

    // Track all agent calls for the UI
    const agentCalls: AgentCall[] = [];

    // Orchestrator message loop
    const orchestratorMessages: OpenAI.Responses.ResponseInputItem[] = [
      { role: "user", content: task },
    ];

    let iterations = 0;
    let finalSynthesis = "";

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;

      const orchestratorResponse = await client.responses.create({
        model: "gpt-4.1-mini",
        temperature: 0.2,
        instructions: ORCHESTRATOR_SYSTEM_PROMPT,
        tools,
        tool_choice: iterations === 1 ? "required" : "auto",
        input: orchestratorMessages,
      });

      // Collect all function calls in this response turn
      const functionCalls = orchestratorResponse.output.filter(
        (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
          item.type === "function_call"
      );

      // If no function calls, the orchestrator is ready to synthesize
      if (functionCalls.length === 0) {
        // If agents were called, force a structured synthesis with explicit attribution
        if (agentCalls.length > 0) {
          const agentSummaryBlock = agentCalls
            .map(
              (call) =>
                `=== ${AGENTS[call.agent].name} ===\n${call.response}`
            )
            .join("\n\n");

          orchestratorMessages.push(...orchestratorResponse.output);
          orchestratorMessages.push({
            role: "user",
            content:
              `Here are all agent responses, labeled by agent name:\n\n${agentSummaryBlock}\n\n` +
              `Write your final synthesis using EXACTLY this structure — no exceptions:\n\n` +
              agentCalls
                .map((call) => `## ${AGENTS[call.agent].name}\n<summary of this agent's contribution>`)
                .join("\n\n") +
              `\n\n## Summary\n<2-3 sentence cross-agent conclusion>`,
          });

          const synthesisResponse = await client.responses.create({
            model: "gpt-4.1-mini",
            temperature: 0.2,
            instructions: ORCHESTRATOR_SYSTEM_PROMPT,
            input: orchestratorMessages,
          });

          const textOutput = synthesisResponse.output.find(
            (item): item is OpenAI.Responses.ResponseOutputMessage =>
              item.type === "message"
          );
          finalSynthesis =
            textOutput?.content
              .filter(
                (c): c is OpenAI.Responses.ResponseOutputText =>
                  c.type === "output_text"
              )
              .map((c) => c.text)
              .join("") ?? "";
        } else {
          const textOutput = orchestratorResponse.output.find(
            (item): item is OpenAI.Responses.ResponseOutputMessage =>
              item.type === "message"
          );
          finalSynthesis =
            textOutput?.content
              .filter(
                (c): c is OpenAI.Responses.ResponseOutputText =>
                  c.type === "output_text"
              )
              .map((c) => c.text)
              .join("") ?? "";
        }
        break;
      }

      // Append orchestrator's output (including function call requests) to history
      orchestratorMessages.push(...orchestratorResponse.output);

      // Execute each function call
      for (const call of functionCalls) {
        const args = JSON.parse(call.arguments) as {
          agent: AgentKey;
          task: string;
          context?: string;
        };

        const agentResponse = await callAgent(
          client,
          args.agent,
          args.task,
          args.context
        );

        agentCalls.push({
          agent: args.agent,
          task: args.task,
          context: args.context,
          response: agentResponse,
        });

        // Return the tool result to the orchestrator
        orchestratorMessages.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: agentResponse,
        });
      }
    }

    if (!finalSynthesis) {
      finalSynthesis =
        "Orchestration completed but no synthesis was generated. Please review the agent outputs above.";
    }

    return Response.json({
      ok: true,
      agentCalls,
      synthesis: finalSynthesis,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
