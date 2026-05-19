"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, Pause, Send, Trash2, X } from "lucide-react";

interface VoiceRecorderProps {
  onSend: (blob: Blob) => void;
  onCancel: () => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onSend, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const getSupportedMimeType = () => {
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
    return types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const actualMime = mediaRecorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: actualMime });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        audioRef.current = new Audio(url);
        audioRef.current.onended = () => {
          setIsPlaying(false);
          setPlaybackTime(0);
        };
        audioRef.current.ontimeupdate = () => {
          if (audioRef.current) setPlaybackTime(Math.floor(audioRef.current.currentTime));
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Please allow microphone access to record voice messages.");
      onCancel();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleSend = () => {
    if (audioBlob) {
      onSend(audioBlob);
    }
  };

  const handleTrash = () => {
    setAudioBlob(null);
    setRecordingTime(0);
    setPlaybackTime(0);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  // Start recording automatically when mounted
  useEffect(() => {
    startRecording();
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="flex items-center gap-4 bg-secondary/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-primary/20 w-full animate-in slide-in-from-bottom-2">
      <div className="flex items-center gap-2 flex-1">
        {isRecording ? (
          <>
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-foreground min-w-[40px]">
              {formatTime(recordingTime)}
            </span>
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-red-500 animate-recording-bar w-full" />
            </div>
          </>
        ) : audioBlob ? (
          <>
            <button 
              onClick={togglePlayback}
              className="p-1.5 bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-all"
            >
              {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </button>
            <span className="text-xs text-muted-foreground font-mono">
              {formatTime(playbackTime)} / {formatTime(recordingTime)}
            </span>
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-100" 
                style={{ width: `${(playbackTime / recordingTime) * 100}%` }}
              />
            </div>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Initializing...</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isRecording ? (
          <>
            <button
              onClick={onCancel}
              className="p-2 text-muted-foreground hover:text-foreground transition-all"
              title="Cancel"
            >
              <X size={20} />
            </button>
            <button
              onClick={stopRecording}
              className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all scale-110 active:scale-95"
              title="Stop Recording"
            >
              <Square size={18} fill="white" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleTrash}
              className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
              title="Discard"
            >
              <Trash2 size={20} />
            </button>
            <button
              onClick={handleSend}
              className="p-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-95"
              title="Send Voice Message"
            >
              <Send size={20} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
