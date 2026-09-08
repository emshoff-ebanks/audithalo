import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCurrentMembership, canSupervise } from "@/lib/authz";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB (Whisper limit)

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !canSupervise(membership.role)) {
    return NextResponse.json(
      { error: "Only supervisors can transcribe recordings." },
      { status: 403 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Transcription is not configured." },
      { status: 503 }
    );
  }

  const formData = await req.formData();
  const audioFile = formData.get("audio");
  if (!audioFile || !(audioFile instanceof File)) {
    return NextResponse.json(
      { error: "No audio file provided." },
      { status: 400 }
    );
  }

  if (audioFile.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Audio file too large. Maximum is 25MB." },
      { status: 400 }
    );
  }

  if (audioFile.size === 0) {
    return NextResponse.json(
      { error: "Audio file is empty." },
      { status: 400 }
    );
  }

  try {
    const openai = new OpenAI({ apiKey });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "en",
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    });

    const segments = (
      transcription as unknown as {
        segments?: Array<{ start: number; end: number; text: string }>;
      }
    ).segments;

    const plainText = transcription.text;

    const timestamped = segments
      ? segments
          .map((s) => {
            const min = Math.floor(s.start / 60);
            const sec = Math.floor(s.start % 60)
              .toString()
              .padStart(2, "0");
            return `[${min}:${sec}] ${s.text.trim()}`;
          })
          .join("\n")
      : plainText;

    return NextResponse.json({
      text: plainText,
      timestamped,
      durationSeconds: transcription.duration ?? null,
    });
  } catch (err) {
    console.error("[transcribe] Whisper API error:", err);
    const message =
      err instanceof Error ? err.message : "Transcription failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
