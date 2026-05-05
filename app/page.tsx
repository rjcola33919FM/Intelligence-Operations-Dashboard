"use client";

import { FormEvent, useState } from "react";
import { AGENTS, type AgentKey } from "@/app/lib/agents";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

interface AgentCall {
  agent: AgentKey;
  task: string;
  context?: string;
  response: string;
}

const MAX_MESSAGE_LENGTH = 2000;
const MAX_TASK_LENGTH = 4000;

type Mode = "single" | "orchestrate";

export default function Home() {
  // Single agent mode
  const [agent, setAgent] = useState<AgentKey>("dataAnalyst");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Orchestration mode
  const [task, setTask] = useState("");
  const [agentCalls, setAgentCalls] = useState<AgentCall[]>([]);
  const [synthesis, setSynthesis] = useState("");

  const [mode, setMode] = useState<Mode>("single");
  const [loading, setLoading] = useState(false);

  // ── Single agent ──────────────────────────────────────────────────────────

  async function handleSingleSubmit(e: FormEvent) {
    e.preventDefault();

    const trimmed = message.trim();
    if (!trimmed || loading) return;

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Message too long. Please keep it under ${MAX_MESSAGE_LENGTH} characters.`,
        },
      ]);
      return;
    }

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          agent,
          history: [...messages, { role: "user", content: trimmed }],
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Request failed");

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply || "No response returned." },
      ]);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${msg}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleAgentChange(newAgent: AgentKey) {
    setAgent(newAgent);
    setMessages([]);
  }

  // ── Orchestration ─────────────────────────────────────────────────────────

  async function handleOrchestrateSubmit(e: FormEvent) {
    e.preventDefault();

    const trimmed = task.trim();
    if (!trimmed || loading) return;

    if (trimmed.length > MAX_TASK_LENGTH) {
      setSynthesis(`Task too long. Please keep it under ${MAX_TASK_LENGTH} characters.`);
      return;
    }

    setAgentCalls([]);
    setSynthesis("");
    setLoading(true);

    try {
      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: trimmed }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Request failed");

      setAgentCalls(data.agentCalls ?? []);
      setSynthesis(data.synthesis ?? "");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      setSynthesis(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────────

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "10px 24px",
    borderRadius: "8px 8px 0 0",
    border: "1px solid #ccc",
    borderBottom: active ? "1px solid white" : "1px solid #ccc",
    background: active ? "white" : "#f5f5f5",
    cursor: "pointer",
    fontWeight: active ? 700 : 400,
    marginRight: 4,
    position: "relative",
    bottom: -1,
  });

  const agentColors: Record<AgentKey, string> = {
    dataAnalyst: "#dbeafe",
    realEstate: "#dcfce7",
    matterMaps: "#fef3c7",
    islt: "#f3e8ff",
  };

  const agentBorderColors: Record<AgentKey, string> = {
    dataAnalyst: "#93c5fd",
    realEstate: "#86efac",
    matterMaps: "#fcd34d",
    islt: "#c4b5fd",
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 4 }}>
        Ops Intelligence Command
      </h1>
      <p style={{ marginBottom: 24, color: "#666" }}>
        Chat with a single agent or run a complex task through the multi-agent orchestrator.
      </p>

      {/* Mode tabs */}
      <div style={{ marginBottom: 0 }}>
        <button style={tabStyle(mode === "single")} onClick={() => setMode("single")}>
          Single Agent
        </button>
        <button style={tabStyle(mode === "orchestrate")} onClick={() => setMode("orchestrate")}>
          Multi-Agent Orchestrator
        </button>
      </div>

      <div
        style={{
          border: "1px solid #ccc",
          borderRadius: "0 8px 8px 8px",
          padding: 24,
          background: "white",
        }}
      >
        {/* ── Single agent mode ── */}
        {mode === "single" && (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                Select Agent
              </label>
              <select
                value={agent}
                onChange={(e) => handleAgentChange(e.target.value as AgentKey)}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  minWidth: 280,
                }}
              >
                {(Object.keys(AGENTS) as AgentKey[]).map((key) => (
                  <option key={key} value={key}>
                    {AGENTS[key].name}
                  </option>
                ))}
              </select>
              <p style={{ marginTop: 6, color: "#666", fontSize: 13 }}>
                {AGENTS[agent].description}
              </p>
            </div>

            <div
              style={{
                border: "1px solid #ddd",
                borderRadius: 12,
                padding: 16,
                minHeight: 320,
                marginBottom: 16,
                overflowY: "auto",
                maxHeight: 480,
              }}
            >
              {messages.length === 0 ? (
                <p style={{ color: "#999" }}>Choose an agent, then enter your question.</p>
              ) : (
                messages.map((msg, i) => (
                  <div
                    key={i}
                    style={{
                      marginBottom: 16,
                      padding: 12,
                      borderRadius: 8,
                      background: msg.role === "user" ? "#f5f5f5" : "#eef6ff",
                    }}
                  >
                    <strong>{msg.role === "user" ? "You" : AGENTS[agent].name}:</strong>
                    <pre
                      style={{
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        marginTop: 8,
                        fontFamily: "inherit",
                      }}
                    >
                      {msg.content}
                    </pre>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSingleSubmit} style={{ display: "flex", gap: 12 }}>
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask a question..."
                disabled={loading}
                maxLength={MAX_MESSAGE_LENGTH}
                style={{
                  flex: 1,
                  padding: 12,
                  border: "1px solid #ccc",
                  borderRadius: 8,
                  opacity: loading ? 0.6 : 1,
                }}
              />
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: "12px 18px",
                  borderRadius: 8,
                  border: "1px solid #222",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? "Thinking..." : "Send"}
              </button>
            </form>
          </>
        )}

        {/* ── Orchestration mode ── */}
        {mode === "orchestrate" && (
          <>
            <p style={{ marginBottom: 12, color: "#555", fontSize: 14 }}>
              Describe a complex task. The orchestrator will determine which agents to involve,
              pass context between them, and synthesize their outputs.
            </p>

            <form onSubmit={handleOrchestrateSubmit} style={{ marginBottom: 24 }}>
              <textarea
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="e.g. Analyze the investment potential of a 3-unit property in Miami, identify any legal risks, and outline a data-driven acquisition strategy."
                disabled={loading}
                maxLength={MAX_TASK_LENGTH}
                rows={4}
                style={{
                  width: "100%",
                  padding: 12,
                  border: "1px solid #ccc",
                  borderRadius: 8,
                  fontFamily: "inherit",
                  fontSize: 14,
                  resize: "vertical",
                  opacity: loading ? 0.6 : 1,
                  boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  type="submit"
                  disabled={loading || !task.trim()}
                  style={{
                    padding: "12px 24px",
                    borderRadius: 8,
                    border: "1px solid #222",
                    background: "#111",
                    color: "white",
                    fontWeight: 600,
                    cursor: loading || !task.trim() ? "not-allowed" : "pointer",
                    opacity: loading || !task.trim() ? 0.5 : 1,
                  }}
                >
                  {loading ? "Orchestrating..." : "Run Orchestration"}
                </button>
              </div>
            </form>

            {/* Agent pipeline visualization */}
            {agentCalls.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
                  Agent Pipeline ({agentCalls.length} agent{agentCalls.length !== 1 ? "s" : ""} invoked)
                </h3>
                {agentCalls.map((call, i) => (
                  <div key={i} style={{ display: "flex", marginBottom: 16, gap: 12 }}>
                    {/* Step indicator */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: agentColors[call.agent],
                          border: `2px solid ${agentBorderColors[call.agent]}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: 13,
                          flexShrink: 0,
                        }}
                      >
                        {i + 1}
                      </div>
                      {i < agentCalls.length - 1 && (
                        <div
                          style={{
                            width: 2,
                            flex: 1,
                            background: "#ddd",
                            marginTop: 4,
                            minHeight: 16,
                          }}
                        />
                      )}
                    </div>

                    {/* Agent card */}
                    <div
                      style={{
                        flex: 1,
                        border: `1px solid ${agentBorderColors[call.agent]}`,
                        borderRadius: 10,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          background: agentColors[call.agent],
                          padding: "8px 14px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <strong style={{ fontSize: 14 }}>{AGENTS[call.agent].name}</strong>
                        {call.context && (
                          <span
                            style={{
                              fontSize: 11,
                              background: "rgba(0,0,0,0.08)",
                              padding: "2px 8px",
                              borderRadius: 20,
                            }}
                          >
                            received context
                          </span>
                        )}
                      </div>
                      <div style={{ padding: 14 }}>
                        <p style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                          <strong>Task:</strong> {call.task}
                        </p>
                        <pre
                          style={{
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            fontSize: 13,
                            fontFamily: "inherit",
                            margin: 0,
                            color: "#333",
                          }}
                        >
                          {call.response}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Synthesis */}
            {synthesis && (
              <div
                style={{
                  border: "2px solid #111",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    background: "#111",
                    color: "white",
                    padding: "10px 16px",
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  Orchestrator Synthesis
                </div>
                <div style={{ padding: 16 }}>
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      fontFamily: "inherit",
                      fontSize: 14,
                      margin: 0,
                    }}
                  >
                    {synthesis}
                  </pre>
                </div>
              </div>
            )}

            {/* Loading state */}
            {loading && agentCalls.length === 0 && (
              <div style={{ textAlign: "center", padding: 32, color: "#666" }}>
                <p>Orchestrator is routing your task to the appropriate agents...</p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
