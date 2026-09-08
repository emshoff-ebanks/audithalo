"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type RecordingState = "idle" | "consent" | "recording" | "uploading" | "done" | "error";

interface RecordSessionPanelProps {
  sessionEventId: string;
  onTranscriptReady?: (transcript: string) => void;
}

function getSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t));
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function RecordSessionPanel({
  sessionEventId,
  onTranscriptReady,
}: RecordSessionPanelProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [consentChecked, setConsentChecked] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      if (!mimeType) {
        setErrorMessage(
          "Your browser does not support any compatible audio format."
        );
        setState("error");
        cleanup();
        return;
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onerror = () => {
        setErrorMessage("Recording failed unexpectedly.");
        setState("error");
        cleanup();
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });

        if (blob.size === 0) {
          setErrorMessage(
            "No audio was captured. Check your microphone and try again."
          );
          setState("error");
          cleanup();
          return;
        }

        if (blob.size > 25 * 1024 * 1024) {
          setErrorMessage(
            "Recording exceeds the 25 MB limit. Try a shorter session or split into parts."
          );
          setState("error");
          cleanup();
          return;
        }

        setState("uploading");

        try {
          const formData = new FormData();
          formData.append("audio", blob, `session-${sessionEventId}.webm`);
          formData.append("sessionEventId", sessionEventId);

          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const errBody = await res.json().catch(() => null);
            throw new Error(
              errBody?.error || `Transcription failed (${res.status})`
            );
          }

          const data = await res.json();
          const transcript = data.timestamped || data.text;

          if (!transcript) {
            throw new Error("No transcript was returned.");
          }

          onTranscriptReady?.(transcript);
          setState("done");
        } catch (err) {
          setErrorMessage(
            err instanceof Error ? err.message : "Transcription failed."
          );
          setState("error");
        } finally {
          cleanup();
        }
      };

      recorder.start(5000);
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
      setState("recording");
    } catch (err) {
      let message = "Could not access the microphone.";

      if (err instanceof DOMException) {
        switch (err.name) {
          case "NotAllowedError":
            message =
              "Microphone access was denied. Click the lock icon in your address bar, set Microphone to Allow, then reload.";
            break;
          case "NotFoundError":
            message = "No microphone found.";
            break;
          case "NotReadableError":
            message = "Microphone is in use by another app.";
            break;
        }
      }

      setErrorMessage(message);
      setState("error");
      cleanup();
    }
  }, [sessionEventId, onTranscriptReady, cleanup]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  if (state === "done") {
    return null;
  }

  if (state === "idle") {
    return (
      <Button
        variant="outline"
        onClick={() => {
          setConsentChecked(false);
          setState("consent");
        }}
      >
        <Mic className="mr-2 h-4 w-4" />
        Record in-person session
      </Button>
    );
  }

  if (state === "consent") {
    return (
      <div className="rounded-lg border border-border p-4 space-y-4">
        <div className="flex items-start gap-3">
          <Mic className="mt-0.5 h-5 w-5 text-foreground/70 shrink-0" />
          <p className="text-sm text-foreground/70">
            Audio will be recorded, transcribed, then immediately discarded.
            Only the text transcript is saved.
          </p>
        </div>

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            className="mt-1 accent-[color:var(--color-gold)]"
          />
          <span className="text-sm text-foreground">
            Both parties present consent to this recording. I understand that
            some states require all-party consent for audio recording.
          </span>
        </label>

        <div className="flex gap-2">
          <Button
            onClick={startRecording}
            disabled={!consentChecked}
          >
            Start recording
          </Button>
          <Button
            variant="ghost"
            onClick={() => setState("idle")}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (state === "recording") {
    return (
      <div className="rounded-lg border border-[color:var(--color-risk)]/30 bg-[color:var(--color-risk)]/5 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--color-risk)] opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-[color:var(--color-risk)]" />
          </span>
          <span className="text-sm font-medium text-foreground">Recording</span>
          <span className="font-mono text-sm tabular-nums text-foreground/70">
            {formatTime(elapsed)}
          </span>
        </div>

        <Button variant="destructive" onClick={stopRecording}>
          <Square className="mr-2 h-4 w-4" />
          Stop recording
        </Button>
      </div>
    );
  }

  if (state === "uploading") {
    return (
      <div className="rounded-lg border border-border p-4 space-y-2">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-foreground/70" />
          <span className="text-sm font-medium text-foreground">
            Transcribing your session...
          </span>
        </div>
        <p className="text-sm text-secondary pl-8">
          This may take a minute for longer recordings.
        </p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-lg border border-[color:var(--color-risk)]/30 bg-[color:var(--color-risk)]/5 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-[color:var(--color-risk)] shrink-0" />
          <p className="text-sm text-foreground">{errorMessage}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setErrorMessage("");
            setState("idle");
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  return null;
}
