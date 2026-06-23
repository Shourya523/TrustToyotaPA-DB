"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, X, AlertCircle, Sparkles } from "lucide-react";

export default function VoiceMicAssistant() {
  const router = useRouter();
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check Web Speech API support
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        setTranscript("");
        setErrorMsg(null);
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        setTranscript(finalTranscript || interimTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setErrorMsg("Microphone permission denied.");
        } else {
          setErrorMsg(`Error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        // Wait briefly, then redirect if transcript was captured
        setTimeout(() => {
          setTranscript((curr) => {
            if (curr.trim()) {
              router.push(`/dashboard/query?voice_query=${encodeURIComponent(curr.trim())}`);
            }
            return curr;
          });
        }, 800);
      };

      recognitionRef.current = recognition;
    }
  }, [router]);

  const toggleListening = () => {
    if (!isSupported) return;

    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const closeOverlay = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setTranscript("");
    setErrorMsg(null);
  };

  if (!isSupported) return null;

  return (
    <>
      {/* Floating Microphone Action Button */}
      <button
        onClick={toggleListening}
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 group ${
          isListening
            ? "bg-red-600 animate-pulse text-white border border-red-500/30"
            : "bg-card text-foreground hover:bg-red-600 hover:text-white border border-border shadow-lg"
        }`}
        title="Voice Showroom Query"
      >
        {isListening ? (
          <MicOff className="w-6 h-6 animate-bounce" />
        ) : (
          <Mic className="w-6 h-6 text-red-500 group-hover:text-white" />
        )}
        {/* Glow rings around mic when listening */}
        {isListening && (
          <span className="absolute inset-0 rounded-full bg-red-600/30 -z-10 animate-ping" />
        )}
      </button>

      {/* Modern Waveform Listening Modal Overlay */}
      {isListening && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-md bg-card/90 border border-border/80 p-6 sm:p-8 rounded-3xl shadow-2xl text-center space-y-6">
            {/* Close Button */}
            <button
              onClick={closeOverlay}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Glowing Icon Header */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 shadow-inner">
                <Mic className="w-8 h-8 text-red-600 animate-pulse" />
                <span className="absolute inset-0 rounded-full border border-red-500/40 animate-ping opacity-60" />
              </div>
              <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest mt-2 flex items-center gap-1.5 justify-center">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Toyota Showroom AI Listening
              </p>
            </div>

            {/* Audio Waveform Micro-Animation */}
            <div className="flex items-center justify-center gap-1.5 h-8">
              {[0.4, 0.9, 0.6, 1.2, 0.5, 0.9, 0.4].map((delay, idx) => (
                <div
                  key={idx}
                  className="w-1 bg-red-600 rounded-full animate-pulse"
                  style={{
                    height: "100%",
                    animationDuration: `${delay}s`,
                    animationDelay: `${idx * 0.1}s`,
                  }}
                />
              ))}
            </div>

            {/* Voice Transcript Display */}
            <div className="min-h-[64px] bg-secondary/30 rounded-2xl p-4 border border-border/40 flex items-center justify-center">
              {transcript.trim() ? (
                <p className="text-sm font-medium text-foreground italic leading-relaxed">
                  "{transcript}"
                </p>
              ) : (
                <p className="text-xs text-muted-foreground leading-normal">
                  "Say something like 'Which car models are mostly sold?' or 'Who is the top sales representative?'"
                </p>
              )}
            </div>

            {/* Error messaging */}
            {errorMsg && (
              <div className="flex items-center gap-2 text-xs text-red-500 bg-red-500/10 p-3 rounded-xl border border-red-500/20 justify-center">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            {/* Hint */}
            <p className="text-[10px] text-muted-foreground font-medium">
              We will automatically route and translate your spoken request to PostgreSQL.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
