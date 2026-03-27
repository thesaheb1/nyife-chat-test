import { useEffect, useState } from 'react';

export function useVideoPoster(src?: string | null) {
  const [posterSrc, setPosterSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!src || typeof document === 'undefined') {
      setPosterSrc(undefined);
      return undefined;
    }

    let cancelled = false;
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = src;

    const capturePoster = () => {
      if (cancelled) {
        return;
      }

      const width = video.videoWidth || 0;
      const height = video.videoHeight || 0;

      if (!width || !height) {
        setPosterSrc(undefined);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');

      if (!context) {
        setPosterSrc(undefined);
        return;
      }

      try {
        context.drawImage(video, 0, 0, width, height);
        setPosterSrc(canvas.toDataURL('image/jpeg', 0.88));
      } catch {
        setPosterSrc(undefined);
      }
    };

    const handleLoadedData = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        capturePoster();
      }
    };

    const handleSeeked = () => {
      capturePoster();
    };

    const handleError = () => {
      if (!cancelled) {
        setPosterSrc(undefined);
      }
    };

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('error', handleError);

    const primeVideo = async () => {
      try {
        await video.play();
        video.pause();
      } catch {
        // Ignore autoplay restrictions; metadata loading is enough.
      }

      try {
        video.currentTime = 0.05;
      } catch {
        capturePoster();
      }
    };

    void primeVideo();

    return () => {
      cancelled = true;
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
    };
  }, [src]);

  return posterSrc;
}
