import React, { useEffect, useRef, useState } from 'react';
import { Camera, ChevronLeft, Loader2, Upload } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { importCapturedImage, importDocument } from '../services/documentImportService';

const Scan = ({ onTextScanned, onBack }) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);
  const [statusMessage, setStatusMessage] = useState(t('scan.frameHint'));
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(document.createElement('canvas'));
  const streamRef = useRef(null);

  useEffect(() => {
    setStatusMessage(cameraActive ? t('scan.frameHint') : `${t('common.unavailableCamera')}.`);
  }, [cameraActive, t]);

  useEffect(() => {
    if (cameraActive) {
      startCamera();
    }

    return () => stopCamera();
  }, [cameraActive]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStatusMessage(t('scan.frameHint'));
    } catch {
      setCameraActive(false);
      setStatusMessage(`${t('common.unavailableCamera')}.`);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleBack = () => {
    stopCamera();
    onBack();
  };

  const capturePhoto = async () => {
    if (!videoRef.current) {
      return;
    }

    setLoading(true);
    setStatusMessage(t('scan.analyzingPhoto'));
    try {
      const video = videoRef.current;
      if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
        throw new Error(t('scan.cameraNotReady'));
      }
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const base64Image = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
      stopCamera();
      const result = await importCapturedImage(base64Image, 'image/jpeg');
      if (onTextScanned) {
        onTextScanned(result);
      }
    } catch (error) {
      alert(t('scan.scanError', { message: error.message }));
    } finally {
      setLoading(false);
      setStatusMessage(cameraActive ? t('scan.frameHint') : `${t('common.unavailableCamera')}.`);
    }
  };

  const handleFileUpload = async ({ target }) => {
    const file = target.files?.[0];
    if (!file) {
      return;
    }

    setLoading(true);
    setStatusMessage(t('scan.fileAnalyze', { name: file.name }));

    try {
      stopCamera();
      const savedText = await importDocument(file);
      if (onTextScanned) {
        onTextScanned(savedText);
      }
    } catch (error) {
      alert(t('scan.scanError', { message: error.message }));
    } finally {
      setLoading(false);
      setStatusMessage(cameraActive ? t('scan.frameHint') : `${t('common.unavailableCamera')}.`);
      target.value = '';
    }
  };

  return (
    <section className="scan-screen">
      {cameraActive ? (
        <video ref={videoRef} autoPlay playsInline className="scan-screen__video" />
      ) : (
        <div className="scan-screen__fallback">
          <Camera size={40} />
          <strong>{t('common.unavailableCamera')}</strong>
          <span>{t('scan.cameraUnavailableBody')}</span>
        </div>
      )}

      <div className="scan-screen__overlay">
        <header className="screen-header screen-header--overlay">
          <button type="button" className="icon-chip icon-chip--dark" onClick={handleBack}>
            <ChevronLeft size={20} />
          </button>
          <h2>{t('scan.title')}</h2>
          <button type="button" className="icon-chip icon-chip--dark" onClick={() => fileInputRef.current?.click()}>
            <Upload size={20} />
          </button>
        </header>

        <div className="scan-frame">
          <span className="scan-frame__corner top-left" />
          <span className="scan-frame__corner top-right" />
          <span className="scan-frame__corner bottom-left" />
          <span className="scan-frame__corner bottom-right" />
          <span className="scan-frame__laser" />
        </div>

        <div className="scan-screen__footer">
          <p>{loading ? t('scan.analyzingProgress') : statusMessage}</p>
          <button type="button" className="scan-upload-button" onClick={() => fileInputRef.current?.click()} disabled={loading}>
            <Upload size={18} />
            <span>{t('scan.importCta')}</span>
          </button>
          <button type="button" className="capture-button" onClick={capturePhoto} disabled={loading || !cameraActive}>
            {loading ? <Loader2 size={26} className="spin" /> : <span className="capture-button__inner" />}
          </button>
          {!cameraActive && (
            <button type="button" className="scan-retry-button" onClick={() => { setCameraActive(true); startCamera(); }} disabled={loading}>
              {t('common.retryCamera')}
            </button>
          )}
        </div>
      </div>

      <input ref={fileInputRef} type="file" hidden accept="image/*,.pdf" onChange={handleFileUpload} />
    </section>
  );
};

export default Scan;
