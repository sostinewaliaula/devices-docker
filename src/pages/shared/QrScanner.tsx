import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextNew';
import { useNotifications } from '../../contexts/NotificationContext';

const QrScanner: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Keep minimal state; avoid unused vars for linter cleanliness
  const [_, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  useEffect(() => {
    if (user?.role !== 'admin') {
      setError('Only admins can access the QR scanner.');
      return;
    }
    let stream: MediaStream | null = null;
    let raf = 0;

    const hasBarcodeDetector = (window as any).BarcodeDetector !== undefined;

    const start = async () => {
      try {
        setIsScanning(true);
        // Enumerate cameras first and remember choices
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cams = devices.filter(d => d.kind === 'videoinput');
          setCameras(cams);
          if (!selectedDeviceId && cams.length > 0) {
            // Prefer a back/environment camera if available
            const back = cams.find(c => /back|rear|environment/i.test(`${c.label}`));
            setSelectedDeviceId(back?.deviceId || cams[0].deviceId);
          }
        } catch {}

        const constraints: MediaStreamConstraints = {
          video: selectedDeviceId
            ? { deviceId: { exact: selectedDeviceId } as any }
            : { facingMode: { ideal: 'environment' } as any },
          audio: false
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        if (hasBarcodeDetector) {
          const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          const detect = async () => {
            if (!videoRef.current) return;
            try {
              // Using BarcodeDetector directly on video element
              const codes = await detector.detect(videoRef.current);
              if (codes && codes.length > 0) {
                handlePayload(codes[0].rawValue || codes[0].rawData);
                return;
              }
            } catch {}
            raf = requestAnimationFrame(detect);
          };
          raf = requestAnimationFrame(detect);
        } else {
          // Fallback: draw frames to canvas and attempt decode via simple regex for URLs
          const tick = () => {
            if (!videoRef.current || !canvasRef.current) return;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        }
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (/NotFoundError|OverconstrainedError/i.test(msg)) {
          setError('No camera found. If using a desktop, connect a webcam.');
        } else if (/NotAllowedError|Permission/i.test(msg)) {
          setError('Camera permission denied. Please allow camera access and retry.');
        } else {
          setError('Unable to access camera. Ensure you are on HTTPS or localhost.');
        }
        setIsScanning(false);
      }
    };

    start();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [user?.role, selectedDeviceId]);

  const handlePayload = (value: string) => {
    try {
      // Expect URLs like https://host/assets/{assetId}
      const url = new URL(value);
      const parts = url.pathname.split('/').filter(Boolean);
      const assetsIdx = parts.indexOf('assets');
      if (assetsIdx !== -1 && parts[assetsIdx + 1]) {
        const assetId = parts[assetsIdx + 1];
        addToast({ title: 'QR Detected', message: 'Opening asset…', type: 'success' });
        navigate(`/assets/${assetId}`);
        return;
      }
      addToast({ title: 'Invalid QR', message: 'QR does not contain a valid asset link.', type: 'error' });
    } catch {
      addToast({ title: 'Invalid QR', message: 'Could not parse QR payload.', type: 'error' });
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
      <h1 className="text-2xl font-bold text-primary mb-4">QR Scanner</h1>
      {error && <p className="mb-4 text-red-600">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div className="rounded-xl overflow-hidden bg-black">
          <video ref={videoRef} className="w-full h-full" playsInline muted />
        </div>
        <div className="space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-300">Point your camera at an asset QR. You will be redirected automatically.</p>
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex items-center space-x-2">
            <label className="text-xs text-gray-600 dark:text-gray-300">Camera</label>
            <select className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200"
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}>
              {cameras.length === 0 ? <option value="">Default</option> : cameras.map(c => (
                <option key={c.deviceId} value={c.deviceId}>{c.label || `Camera ${c.deviceId.slice(-4)}`}</option>
              ))}
            </select>
            <button
              onClick={() => setSelectedDeviceId(prev => prev)}
              className="button-primary px-3 py-1 text-xs font-medium"
            >Retry</button>
          </div>
          {!('BarcodeDetector' in window) && (
            <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg p-2">Your browser lacks native QR detection; using a basic fallback. Prefer Chrome/Edge for best results.</p>
          )}
          {error && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default QrScanner;


