"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string,
        config: {
          videoId: string;
          width?: string;
          height?: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: YouTubeReadyEvent) => void;
            onStateChange?: (event: YouTubeStateChangeEvent) => void;
          };
        },
      ) => YouTubePlayerInstance;
      PlayerState: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type YouTubePlayerInstance = {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
};

type YouTubeReadyEvent = {
  target: YouTubePlayerInstance;
};

type YouTubeStateChangeEvent = {
  data: number;
  target: YouTubePlayerInstance;
};

type YouTubePlayerProps = {
  url: string;
  title: string;
  className?: string;
  onPlay?: (payload: { currentTime: number; duration: number }) => void;
  onPause?: (payload: { currentTime: number; duration: number }) => void;
  onEnded?: (payload: { currentTime: number; duration: number }) => void;
  onProgress?: (payload: { currentTime: number; duration: number }) => void;
};

function getYouTubeVideoId(url: string) {
  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname.includes("youtu.be")) {
      return parsedUrl.pathname.replace("/", "").trim() || null;
    }

    if (parsedUrl.hostname.includes("youtube.com")) {
      const videoId = parsedUrl.searchParams.get("v");
      if (videoId) return videoId;

      const shortsMatch = parsedUrl.pathname.match(/\/shorts\/([^/?]+)/);
      if (shortsMatch?.[1]) return shortsMatch[1];

      const embedMatch = parsedUrl.pathname.match(/\/embed\/([^/?]+)/);
      if (embedMatch?.[1]) return embedMatch[1];
    }
  } catch {
    return null;
  }

  return null;
}

export function YouTubePlayer({
  url,
  title,
  className,
  onPlay,
  onPause,
  onEnded,
  onProgress,
}: YouTubePlayerProps) {
  const reactId = useId();
  const containerId = useMemo(() => `youtube-player-${reactId.replace(/[:]/g, "-")}`, [reactId]);
  const videoId = useMemo(() => getYouTubeVideoId(url), [url]);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const onPlayRef = useRef(onPlay);
  const onPauseRef = useRef(onPause);
  const onEndedRef = useRef(onEnded);
  const onProgressRef = useRef(onProgress);
  const [apiReady, setApiReady] = useState(
    typeof window !== "undefined" && Boolean(window.YT?.Player),
  );

  useEffect(() => {
    onPlayRef.current = onPlay;
  }, [onPlay]);

  useEffect(() => {
    onPauseRef.current = onPause;
  }, [onPause]);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.YT?.Player) return;

    const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.body.appendChild(script);
    }

    const previousHandler = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousHandler?.();
      setApiReady(true);
    };

    return () => {
      window.onYouTubeIframeAPIReady = previousHandler;
    };
  }, []);

  useEffect(() => {
    if (!apiReady || !videoId || !window.YT?.Player) return;

    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    const limparIntervalo = () => {
      if (progressIntervalRef.current !== null) {
        window.clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };

    const iniciarProgresso = (player: YouTubePlayerInstance) => {
      limparIntervalo();
      progressIntervalRef.current = window.setInterval(() => {
        onProgressRef.current?.({
          currentTime: player.getCurrentTime(),
          duration: player.getDuration(),
        });
      }, 1000);
    };

    playerRef.current = new window.YT.Player(containerId, {
      videoId,
      width: "100%",
      height: "100%",
      playerVars: {
        rel: 0,
        modestbranding: 1,
      },
      events: {
        onReady: (event) => {
          onProgressRef.current?.({
            currentTime: event.target.getCurrentTime(),
            duration: event.target.getDuration(),
          });
        },
        onStateChange: (event) => {
          const duration = event.target.getDuration();
          const currentTime = event.target.getCurrentTime();

          if (event.data === window.YT?.PlayerState.PLAYING) {
            onPlayRef.current?.({ currentTime, duration });
            iniciarProgresso(event.target);
          }

          if (event.data === window.YT?.PlayerState.PAUSED) {
            limparIntervalo();
            onPauseRef.current?.({ currentTime, duration });
          }

          if (event.data === window.YT?.PlayerState.ENDED) {
            limparIntervalo();
            onEndedRef.current?.({ currentTime, duration });
          }
        },
      },
    });

    return () => {
      limparIntervalo();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [apiReady, containerId, videoId]);

  if (!videoId) {
    return null;
  }

  return (
    <div className={className}>
      <div id={containerId} className="aspect-video w-full" aria-label={title} />
    </div>
  );
}
