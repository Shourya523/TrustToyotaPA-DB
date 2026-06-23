import * as fs from 'fs';

const logPath = 'C:\\Users\\user\\.gemini\\antigravity-ide\\brain\\7114989b-0b50-48e9-9f2e-a44c9a69df21\\.system_generated\\logs\\transcript.jsonl';

try {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const obj = JSON.parse(line);
    // Find all lines containing "capture_browser_console_logs"
    if (JSON.stringify(obj).includes("capture_browser_console_logs")) {
      console.log("Found line with capture_browser_console_logs:");
      console.log(JSON.stringify(obj).slice(0, 1000));
    }
  }
} catch (e) {
  console.error(e);
}
