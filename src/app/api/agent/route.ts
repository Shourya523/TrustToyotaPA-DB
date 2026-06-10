import { google } from "@ai-sdk/google";
import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { SYSTEM_PROMPT } from "@/src/lib/agent/prompts";
import { agentTools } from "@/src/lib/agent/tools";
import { auth } from "@/src/lib/auth-server";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { messages, connectionId } = await req.json();

    if (!connectionId) {
      return NextResponse.json({ error: "connectionId is required" }, { status: 400 });
    }

    // Set model API key mapping
    if (process.env.GEMINI_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY;
    }

    // Attempt to verify session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    // We can inject connection ID and context into the system instructions
    const systemInstruction = `${SYSTEM_PROMPT}\n\nThe current active connectionId is: "${connectionId}".\nUser session details: ${
      session?.user ? JSON.stringify({ id: session.user.id, name: session.user.name }) : "Guest Mode (Demo)"
    }`;

    const result = await streamText({
      model: google("gemini-3.1-flash-lite"),
      system: systemInstruction,
      messages: await convertToModelMessages(messages),
      tools: agentTools,
      stopWhen: stepCountIs(5),
    });

    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    console.error("Error in Agent API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
