import { useCallback, useEffect, useRef, useState } from 'react';

interface PhotoCaptureProps {
  photo: string | null;
  onCapture: (file: File, preview: string) => void;
  className?: string;
}

const PHOTO_MIME_TYPE = 'image/jpeg';
const CAMERA_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: { ideal: 'environment' },
  width: { ideal: 1280, max: 1920 },
  height: { ideal: 720, max: 1080 },
  frameRate: { ideal: 30, max: 30 },
};

function stopStream(stream: MediaStream | null) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

export function PhotoCapture({ photo, onCapture, className = '' }: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startRequestIdRef = useRef(0);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const releaseCamera = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setIsCameraReady(false);
  }, []);

  const stopCamera = useCallback(() => {
    startRequestIdRef.current += 1;
    setIsStarting(false);
    releaseCamera();
  }, [releaseCamera]);

  const readFileAsDataUrl = useCallback((file: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Unable to read image file'));
      reader.readAsDataURL(file);
    });
  }, []);

  const startCamera = useCallback(async () => {
    if (photo) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera is not supported in this browser.');
      return;
    }

    const requestId = ++startRequestIdRef.current;
    releaseCamera();
    setCameraError(null);
    setIsStarting(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: CAMERA_CONSTRAINTS,
        audio: false,
      });

      if (requestId !== startRequestIdRef.current || photo) {
        stopStream(stream);
        return;
      }

      const [videoTrack] = stream.getVideoTracks();
      if (videoTrack && 'contentHint' in videoTrack) {
        try {
          videoTrack.contentHint = 'motion';
        } catch {
          // Optional browser hint, ignore unsupported runtimes.
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.disablePictureInPicture = true;
        await videoRef.current.play();
      } else {
        stopStream(stream);
        return;
      }

      if (requestId !== startRequestIdRef.current || photo) {
        stopStream(stream);
        return;
      }

      streamRef.current = stream;
      setIsCameraReady(true);
    } catch {
      setCameraError('No camera access. You can choose a photo from gallery.');
      if (requestId === startRequestIdRef.current) {
        releaseCamera();
      }
    } finally {
      if (requestId === startRequestIdRef.current) {
        setIsStarting(false);
      }
    }
  }, [photo, releaseCamera]);

  useEffect(() => {
    if (!photo) {
      void startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [photo, startCamera, stopCamera]);

  useEffect(() => {
    if (photo) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopCamera();
      } else {
        void startCamera();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [photo, startCamera, stopCamera]);

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';

      try {
        const preview = await readFileAsDataUrl(file);
        onCapture(file, preview);
      } catch {
        setCameraError('Could not load photo. Try again.');
      }
    },
    [onCapture, readFileAsDataUrl]
  );

  const handleTakePhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !isCameraReady) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, PHOTO_MIME_TYPE, 0.92);
    });
    if (!blob) {
      setCameraError('Could not take a photo. Try again.');
      return;
    }

    const file = new File([blob], `capture-${Date.now()}.jpg`, {
      type: PHOTO_MIME_TYPE,
      lastModified: Date.now(),
    });

    try {
      const preview = await readFileAsDataUrl(blob);
      onCapture(file, preview);
      stopCamera();
    } catch {
      setCameraError('Could not save photo. Try again.');
    }
  }, [isCameraReady, onCapture, readFileAsDataUrl, stopCamera]);

  return (
    <div className={`rounded-2xl bg-[var(--color-bg-secondary)] overflow-hidden relative ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
      />

      {photo ? (
        <>
          <img src={photo} alt="Food" className="w-full h-full object-cover" />
          <button
            onClick={openFilePicker}
            className="absolute top-3 right-3 bg-black/45 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full"
            aria-label="Retake"
          >
            Retake
          </button>
        </>
      ) : (
        <div className="h-full relative bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

          {(isStarting || !isCameraReady) && !cameraError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-white/80 text-sm px-4 text-center">Starting camera...</p>
            </div>
          )}

          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
              <p className="text-white/85 text-sm text-center">{cameraError}</p>
              <button
                onClick={openFilePicker}
                className="bg-white text-black text-sm font-semibold px-4 py-2 rounded-xl"
              >
                Choose Photo
              </button>
            </div>
          )}

          {!cameraError && (
            <div className="absolute bottom-4 left-0 right-0 px-4 flex items-center justify-center gap-3">
              <button
                onClick={handleTakePhoto}
                disabled={!isCameraReady}
                className="h-14 w-14 rounded-full border-4 border-white bg-white/25 backdrop-blur disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Take photo"
              />
              <button
                onClick={openFilePicker}
                className="bg-black/45 backdrop-blur-sm text-white text-xs font-semibold px-3 py-2 rounded-full"
              >
                Gallery
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
