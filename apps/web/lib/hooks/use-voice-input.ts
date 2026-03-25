"use client"

import { useCallback, useEffect, useRef, useState } from "react"

function getAudioOptions(): MediaRecorderOptions {
  if (typeof MediaRecorder === "undefined") return {}
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
    return { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 64000 }
  }
  if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
    return { mimeType: "audio/ogg;codecs=opus", audioBitsPerSecond: 64000 }
  }
  if (MediaRecorder.isTypeSupported("audio/mp4")) {
    return { mimeType: "audio/mp4", audioBitsPerSecond: 96000 }
  }
  return {}
}

export function useVoiceInput() {
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const startTimeRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const resolveBlobRef = useRef<((blob: Blob) => void) | null>(null)

  const isSupported = typeof navigator !== "undefined"
    && typeof MediaRecorder !== "undefined"
    && !!navigator.mediaDevices?.getUserMedia

  const start = useCallback(async () => {
    setError(null)
    setDuration(0)
    audioChunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const options = getAudioOptions()
      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const mime = mediaRecorderRef.current?.mimeType || "audio/webm"
        const blob = new Blob(audioChunksRef.current, { type: mime })
        resolveBlobRef.current?.(blob)
        resolveBlobRef.current = null
      }

      mediaRecorder.start()
      startTimeRef.current = Date.now()
      setIsRecording(true)

      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 500)
    } catch {
      setError("Microphone access denied")
    }
  }, [])

  const stop = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      resolveBlobRef.current = resolve

      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }

      mediaRecorderRef.current?.stop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setIsRecording(false)
    })
  }, [])

  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    mediaRecorderRef.current?.stop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
    audioChunksRef.current = []
    resolveBlobRef.current = null
    setIsRecording(false)
    setDuration(0)
    setError(null)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      mediaRecorderRef.current?.stop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return {
    isRecording,
    isSupported,
    duration,
    error,
    start,
    stop,
    reset,
  }
}
