"use client";

import { WavRecorder, WavStreamPlayer } from "@/lib/wavtools";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { RealtimeClient } from "@openai/realtime-api-beta";
import { ItemType } from "@openai/realtime-api-beta/dist/lib/client";
import { WavRenderer } from "@/utils/wav_renderer";
import { Button } from "@/components/ui/button";
import { Download, LoaderCircle } from "lucide-react";
import { DecodedAudioType } from "@/lib/wavtools/lib/wav_recorder.js";

// const USE_LOCAL_RELAY_SERVER_URL: string | undefined = 'http://localhost:8081';
const USE_LOCAL_RELAY_SERVER_URL: string | undefined = void 0;
const apiKey: string = process.env.NEXT_PUBLIC_OPENAI_API_KEY!;

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get("role");
  const level = searchParams.get("level");
  const jobDescription = searchParams.get("jd");

  if (!role || !level) {
    router.push("/");
  }

  /**
   * Instantiate:
   * - WavRecorder (speech input)
   * - WavStreamPlayer (speech output)
   * - RealtimeClient (API client)
   */
  const wavRecorderRef = useRef<WavRecorder>(
    new WavRecorder({ sampleRate: 24000 })
  );
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(
    new WavStreamPlayer({ sampleRate: 24000 })
  );
  const clientRef = useRef<RealtimeClient>(
    new RealtimeClient(
      USE_LOCAL_RELAY_SERVER_URL
        ? { url: USE_LOCAL_RELAY_SERVER_URL }
        : {
            apiKey: apiKey,
            dangerouslyAllowAPIKeyInBrowser: true,
          }
    )
  );

  /**
   * References for
   * - Rendering audio visualization (canvas)
   * - Autoscrolling event logs
   * - Timing delta for event log displays
   */
  const clientCanvasRef = useRef<HTMLCanvasElement>(null);
  const serverCanvasRef = useRef<HTMLCanvasElement>(null);
  const startTimeRef = useRef<string>(new Date().toISOString());

  const [items, setItems] = useState<ItemType[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [canPushToTalk, setCanPushToTalk] = useState(true);
  const [isRecording, setIsRecording] = useState(false);

  /**
   * Connect to conversation:
   * WavRecorder taks speech input, WavStreamPlayer output, client is API client
   */
  const connectConversation = useCallback(async () => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    // Set state variables
    startTimeRef.current = new Date().toISOString();
    setIsConnected(true);
    setItems(client.conversation.getItems());

    // Connect to microphone
    await wavRecorder.begin();

    // Connect to audio output
    await wavStreamPlayer.connect();

    // Connect to realtime API
    await client.connect();

    client.sendUserMessageContent([
      {
        type: `input_text`,
        text: `Hello!`,
      },
    ]);

    if (client.getTurnDetectionType() === "server_vad") {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
  }, []);

  /**
   * Disconnect and reset conversation state
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const disconnectConversation = useCallback(async () => {
    setIsConnected(false);
    setItems([]);

    const client = clientRef.current;
    client.disconnect();

    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.end();

    const wavStreamPlayer = wavStreamPlayerRef.current;
    await wavStreamPlayer.interrupt();
  }, []);

  /**
   * In push-to-talk mode, start recording
   * .appendInputAudio() for each sample
   */
  const startRecording = async () => {
    setIsRecording(true);
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const trackSampleOffset = await wavStreamPlayer.interrupt();
    if (trackSampleOffset?.trackId) {
      const { trackId, offset } = trackSampleOffset;
      await client.cancelResponse(trackId, offset);
    }
    await wavRecorder.record((data) => client.appendInputAudio(data.mono));
  };

  /**
   * In push-to-talk mode, stop recording
   */
  const stopRecording = async () => {
    setIsRecording(false);
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.pause();
    client.createResponse();
  };

  /**
   * Switch between Manual <> VAD mode for communication
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const changeTurnEndType = async (value: string) => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    if (value === "none" && wavRecorder.getStatus() === "recording") {
      await wavRecorder.pause();
    }
    client.updateSession({
      turn_detection: value === "none" ? null : { type: "server_vad" },
    });
    if (value === "server_vad" && client.isConnected()) {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
    setCanPushToTalk(value === "none");
  };

  /**
   * Set up render loops for the visualization canvas
   */
  useEffect(() => {
    let isLoaded = true;

    const wavRecorder = wavRecorderRef.current;
    const clientCanvas = clientCanvasRef.current;
    let clientCtx: CanvasRenderingContext2D | null = null;

    const wavStreamPlayer = wavStreamPlayerRef.current;
    const serverCanvas = serverCanvasRef.current;
    let serverCtx: CanvasRenderingContext2D | null = null;

    const render = () => {
      if (isLoaded) {
        if (clientCanvas) {
          if (!clientCanvas.width || !clientCanvas.height) {
            clientCanvas.width = clientCanvas.offsetWidth;
            clientCanvas.height = clientCanvas.offsetHeight;
          }
          clientCtx = clientCtx || clientCanvas.getContext("2d");
          if (clientCtx) {
            clientCtx.clearRect(0, 0, clientCanvas.width, clientCanvas.height);
            const result = wavRecorder.recording
              ? wavRecorder.getFrequencies("voice")
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              clientCanvas,
              clientCtx,
              result.values,
              "#22c55e",
              10,
              0,
              8
            );
          }
        }
        if (serverCanvas) {
          if (!serverCanvas.width || !serverCanvas.height) {
            serverCanvas.width = serverCanvas.offsetWidth;
            serverCanvas.height = serverCanvas.offsetHeight;
          }
          serverCtx = serverCtx || serverCanvas.getContext("2d");
          if (serverCtx) {
            serverCtx.clearRect(0, 0, serverCanvas.width, serverCanvas.height);
            const result = wavStreamPlayer.analyser
              ? wavStreamPlayer.getFrequencies("voice")
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              serverCanvas,
              serverCtx,
              result.values,
              "#3b82f6",
              10,
              0,
              8
            );
          }
        }
        window.requestAnimationFrame(render);
      }
    };
    render();

    return () => {
      isLoaded = false;
    };
  }, []);

  /**
   * Core RealtimeClient and audio capture setup
   * Set all of our instructions, tools, events and more
   */
  useEffect(() => {
    // Get refs
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const client = clientRef.current;

    // Set instructions
    client.updateSession({
      instructions: `You are a professional interviewer conducting a mock interview. Your goal is to evaluate the user for the role of ${role} at a ${level} level. You should ask relevant and challenging questions based on the user's experience and skills expected for this role. The interview should simulate a real job interview, covering various competencies including technical skills, problem-solving, and soft skills. If a job description is provided, align your questions closely with it: ${jobDescription}. Ensure a balanced interview with time for follow-up questions, allowing the user to elaborate on their answers.
The interview should be conversational, where you assess the candidate's responses, give feedback, and ask deeper questions based on their answers. Be formal but approachable, and ensure that the candidate feels comfortable responding.`,
    });
    // Set transcription, otherwise we don't get user transcriptions back
    client.updateSession({ input_audio_transcription: { model: "whisper-1" } });

    // handle realtime events from client + server for event logging
    client.on("error", (event: unknown) => console.error(event));
    client.on("conversation.interrupted", async () => {
      const trackSampleOffset = await wavStreamPlayer.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await client.cancelResponse(trackId, offset);
      }
    });
    client.on(
      "conversation.updated",
      async ({
        item,
        delta,
      }: {
        item: {
          id: string;
          status: string;
          formatted: {
            audio: Float32Array | Int16Array | number[];
            file: DecodedAudioType;
          };
        };
        delta: { audio: ArrayBuffer | Int16Array };
      }) => {
        const items = client.conversation.getItems();
        if (delta?.audio) {
          wavStreamPlayer.add16BitPCM(delta.audio, item.id);
        }
        if (item.status === "completed" && item.formatted.audio?.length) {
          const wavFile = await WavRecorder.decode(
            item.formatted.audio,
            24000,
            24000
          );
          item.formatted.file = wavFile;
        }
        setItems(items);
      }
    );

    setItems(client.conversation.getItems());

    return () => {
      // cleanup; resets to defaults
      client.reset();
    };
  }, [jobDescription, level, role]);

  return (
    <div className="w-full h-screen">
      <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]">
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-fuchsia-400 opacity-20 blur-[100px]"></div>
      </div>
      <div className="p-4 grid grid-cols-2 gap-2 h-full">
        <div className="border rounded-lg border-slate-800 p-4 flex flex-col justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
              AI Mock Interview
            </h1>
            <h3 className="scroll-m-20 text-2xl tracking-tight capitalize">
              Role <span className="font-semibold">{role}</span>
            </h3>
            <h3 className="scroll-m-20 text-2xl tracking-tight capitalize">
              Level <span className="font-semibold">{level}</span>
            </h3>
            <h3 className="scroll-m-20 text-2xl tracking-tight capitalize">
              Job Description
            </h3>
            <span className="text-base line-clamp-6">{jobDescription}</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="border rounded border-slate-800 p-2">
              <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
                Server audio
              </h3>
              <canvas ref={serverCanvasRef} className="w-full" />
            </div>
            <div className="border rounded border-slate-800 p-2">
              <div className="flex items-center justify-between">
                <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
                  Client audio
                </h3>
                {isConnected && canPushToTalk && (
                  <Button
                    disabled={!isConnected || !canPushToTalk}
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    variant={isRecording ? "destructive" : "default"}
                  >
                    {isRecording ? "release to send" : "push to talk"}
                  </Button>
                )}
              </div>
              <canvas ref={clientCanvasRef} className="w-full" />
            </div>
          </div>
        </div>
        <div className="border rounded-lg border-slate-800 p-4 flex flex-col gap-8">
          <div className="flex justify-between">
            <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
              Conversation logs
            </h3>
            <Download />
          </div>
          {!items.length ? (
            <div className="flex flex-1 justify-center items-center">
              <Button onClick={connectConversation}>Start</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-1 max-h-[86vh] overflow-y-auto">
              {items.slice(1).map((conversationItem) => {
                const isUser = conversationItem.role === "user";
                return (
                  <div
                    key={conversationItem.id}
                    className={`flex flex-col gap-1 ${
                      isUser ? "items-end" : "items-start"
                    }`}
                  >
                    <span className="text-sm font-semibold text-gray-500">
                      {(conversationItem.role || conversationItem.type)
                        .replaceAll("_", " ")
                        .replace("user", "you")
                        .replace("assistant", "Jane at ACME Corp")}
                    </span>
                    <div
                      className={`p-2 rounded-lg max-w-[70%] ${
                        isUser
                          ? "bg-green-500 text-white"
                          : "bg-blue-500 text-white"
                      }`}
                      style={{
                        borderTopRightRadius: isUser ? 0 : "1rem",
                        borderTopLeftRadius: isUser ? "1rem" : 0,
                      }}
                    >
                      <span>
                        {conversationItem.formatted.transcript ||
                          (conversationItem.formatted.audio?.length ? (
                            <div className="flex items-center gap-2">
                              <LoaderCircle className="animate-spin" />
                              <span>Processing transcript...</span>
                            </div>
                          ) : (
                            conversationItem.formatted.text || "(item sent)"
                          ))}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
