"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { toast } from "sonner";
import { parseMarkdownToTableData, generateGeminiPrompt, openInGemini } from "@/src/lib/gemini";

export function GeminiButton({ tableName, content }: { tableName: string; content: string }) {
    const [loading, setLoading] = useState(false);

    const handleOpen = async () => {
        setLoading(true);
        try {
            const tableData = parseMarkdownToTableData(tableName, content);
            const prompt = generateGeminiPrompt(tableData);
            await openInGemini(prompt);
            toast.success("Database documentation copied to clipboard. Paste it into Gemini to begin analysis.", {
                duration: 6000,
            });
        } catch (err: any) {
            toast.error("Failed to copy documentation or open Gemini.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            size="sm"
            onClick={handleOpen}
            disabled={loading}
            className="no-print gap-1.5 text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-indigo-500/10 h-8 px-3 rounded-lg transition-all active:scale-95 shrink-0"
        >
            {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            )}
            Open in Gemini
        </Button>
    );
}
