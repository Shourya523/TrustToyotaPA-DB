
import { config } from "dotenv";
config();

process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY;

import { google } from "@ai-sdk/google";
import { generateText, stepCountIs } from "ai";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";

let spinnerInterval: NodeJS.Timeout;
function startSpinner(text: string) {
    const chars = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let i = 0;
    process.stdout.write(`\r\x1b[35m${chars[i]}\x1b[0m ${text}`);
    spinnerInterval = setInterval(() => {
        i = (i + 1) % chars.length;
        process.stdout.write(`\r\x1b[35m${chars[i]}\x1b[0m ${text}`);
    }, 80);
}

function stopSpinner() {
    clearInterval(spinnerInterval);
    process.stdout.write("\r\x1b[K");
}

function printLogo() {
    console.log(`
\x1b[36m  ■ ■ ■ ■    ■ ■ ■ ■    ■ ■ ■ ■ ■   ■ ■ ■ ■        ■ ■      ■ ■ ■ ■ ■
  ■      ■   ■      ■       ■       ■             ■   ■     ■        
  ■      ■   ■ ■ ■ ■        ■       ■            ■ ■ ■ ■    ■ ■ ■ ■ ■
  ■      ■   ■      ■       ■       ■            ■     ■            ■
  ■ ■ ■ ■    ■      ■       ■       ■ ■ ■ ■      ■     ■    ■ ■ ■ ■ ■\x1b[0m
  \x1b[35m================== DATABASE API AGENT ===================\x1b[0m
  Type \x1b[33m"exit"\x1b[0m to quit the session.
    `);
}

async function main() {
    const connectionId = process.env.ACTIVE_CONNECTION_ID;
    if (!connectionId) {
        console.error("ACTIVE_CONNECTION_ID environment variable is missing");
        process.exit(1);
    }

    printLogo();

    const rl = readline.createInterface({ input, output });
    const messages: any[] = [];

    const { SYSTEM_PROMPT } = await import("../src/lib/agent/prompts");
    const { agentTools } = await import("../src/lib/agent/tools");

    try {
        while (true) {
            const userPrompt = await rl.question("\n\x1b[32m You:\x1b[0m ");

            if (userPrompt.trim().toLowerCase() === "exit") {
                console.log("\x1b[33mGoodbye!\x1b[0m");
                break;
            }

            if (!userPrompt.trim()) continue;

            messages.push({ role: "user", content: userPrompt });

            startSpinner("Agent is thinking & executing tools...");

            try {
                const { text, response } = await generateText({
                    model: google("gemini-3.1-flash-lite"),
                    system: `${SYSTEM_PROMPT}\n\nThe current active connectionId is: "${connectionId}".`,
                    messages: messages,
                    tools: agentTools,
                    stopWhen: stepCountIs(5)
                });


                stopSpinner();
                console.log(`\n\x1b[36m Agent:\x1b[0m\n${text}`);
                messages.push(...response.messages);
            } catch (err: any) {
                stopSpinner();
                console.error(`\n Error during execution: ${err.message}`);
            }
        }
    } finally {
        rl.close();
    }
}
main().catch(console.error);

