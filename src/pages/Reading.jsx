import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Globe, Languages, MoreHorizontal, Pause, Play, RotateCcw, RotateCw, Sparkles, Volume2 } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { audioService } from '../services/audioService';
import { apiClient } from '../services/apiService';

const WORDS_PER_MINUTE = 145;

const estimateDuration = (content, rate) => {
  const words = (content || '').trim().split(/\s+/).filter(Boolean).length;
  const seconds = words > 0 ? (words / WORDS_PER_MINUTE) * 60 : 0;
  return Math.max(1, Math.round(seconds / Math.max(rate, 0.5)));
};

const formatTime = (seconds) => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

const assetUrl = (path) => `${import.meta.env.BASE_URL}${path}`;

const Reading = ({ textId, onBack, onStartQuiz }) => {
  const { t } = useI18n();
  const [text, setText] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewMode, setViewMode] = useState('content');
  const [playbackRate, setPlaybackRate] = useState(1);
  const [audioProgress, setAudioProgress] = useState({ currentTime: 0, duration: 1 });
  const progressIntervalRef = useRef(null);
  const playbackStartedAtRef = useRef(0);
  const playbackSessionRef = useRef(0);
  const activeSpeechRef = useRef(null);
  const timelineTrackRef = useRef(null);
  const audioRewardedRef = useRef(false);

  const clearProgressTimer = () => {
    if (progressIntervalRef.current) {
      window.clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  const startProgressTimer = (duration, startAt = 0) => {
    playbackStartedAtRef.current = Date.now() - startAt * 1000;
    setAudioProgress({ currentTime: startAt, duration });
    clearProgressTimer();

    progressIntervalRef.current = window.setInterval(() => {
      const elapsedSeconds = (Date.now() - playbackStartedAtRef.current) / 1000;
      setAudioProgress({
        currentTime: Math.min(elapsedSeconds, duration),
        duration,
      });

      if (elapsedSeconds >= duration) {
        clearProgressTimer();
      }
    }, 200);
  };

  useEffect(() => {
    const loadText = async () => {
      setLoading(true);
      audioRewardedRef.current = false;
      const data = await apiClient.getText(textId);
      setText(data);
      setLoading(false);
    };

    loadText();
  }, [textId]);

  useEffect(
    () => () => {
      playbackSessionRef.current += 1;
      audioService.stop();
      clearProgressTimer();
    },
    [],
  );

  useEffect(() => {
    if (isPlaying || !text?.darijaText) {
      return;
    }

    const duration = estimateDuration(text.darijaText, playbackRate);
    setAudioProgress((current) => ({
      currentTime: Math.min(current.currentTime, duration),
      duration,
    }));
  }, [isPlaying, playbackRate, text?.darijaText]);

  const stopPlayback = (resetProgress = false) => {
    playbackSessionRef.current += 1;
    audioService.stop();
    setIsPlaying(false);
    clearProgressTimer();

    if (resetProgress) {
      setAudioProgress((current) => ({ ...current, currentTime: 0 }));
    }
  };

  const getDarijaTrack = () => {
    const content = text?.darijaText?.trim();
    return content ? { content, lang: 'ar-SA' } : null;
  };

  const speakFrom = async (content, lang, startAt = 0) => {
    const normalizedContent = content?.trim();

    if (!normalizedContent) {
      return;
    }

    const duration = estimateDuration(normalizedContent, playbackRate);
    const boundedStart = Math.min(Math.max(startAt, 0), duration);
    const ratio = duration > 0 ? boundedStart / duration : 0;
    const sliceIndex = normalizedContent.length
      ? Math.min(Math.floor(normalizedContent.length * ratio), normalizedContent.length - 1)
      : 0;
    const segment = boundedStart > 0 ? normalizedContent.slice(sliceIndex).trimStart() || normalizedContent : normalizedContent;
    const sessionId = playbackSessionRef.current + 1;

    playbackSessionRef.current = sessionId;
    activeSpeechRef.current = { content: normalizedContent, lang };
    audioService.stop();
    setIsPlaying(true);
    startProgressTimer(duration, boundedStart);

    if (!audioRewardedRef.current) {
      audioRewardedRef.current = true;
      apiClient.trackAudioSession();
    }

    try {
      await audioService.speak(segment, lang, playbackRate);
    } finally {
      if (playbackSessionRef.current !== sessionId) {
        return;
      }

      setIsPlaying(false);
      clearProgressTimer();
      setAudioProgress((current) => ({ ...current, currentTime: current.duration }));
    }
  };

  const speakText = async (content, lang) => {
    const normalizedContent = content?.trim();

    if (!normalizedContent) {
      return;
    }

    const isSameTrack =
      isPlaying &&
      activeSpeechRef.current?.content === normalizedContent &&
      activeSpeechRef.current?.lang === lang;

    if (isSameTrack) {
      stopPlayback(false);
      return;
    }

    await speakFrom(normalizedContent, lang, 0);
  };

  const speakDarija = async () => {
    const track = getDarijaTrack();

    if (!track) {
      return;
    }

    const isSameTrack = isPlaying && activeSpeechRef.current?.lang === track.lang && activeSpeechRef.current?.content === track.content;

    if (isSameTrack) {
      stopPlayback(false);
      return;
    }

    await speakFrom(track.content, track.lang, audioProgress.currentTime);
  };

  const speakFrench = async () => {
    await speakText(text?.originalText, 'fr-FR');
  };

  const seekAudioTo = async (nextTime) => {
    const track = getDarijaTrack();

    if (!track) {
      return;
    }

    const duration = estimateDuration(track.content, playbackRate);
    const boundedTime = Math.min(Math.max(nextTime, 0), duration);
    activeSpeechRef.current = track;

    if (!isPlaying) {
      setAudioProgress({ currentTime: boundedTime, duration });
      return;
    }

    await speakFrom(track.content, track.lang, boundedTime);
  };

  const handleSeekBy = async (delta) => {
    await seekAudioTo(audioProgress.currentTime + delta);
  };

  const handleTimelineSeek = async (event) => {
    if (!timelineTrackRef.current) {
      return;
    }

    const rect = timelineTrackRef.current.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    await seekAudioTo(audioProgress.duration * Math.min(Math.max(percent, 0), 1));
  };

  const timelineProgress = `${Math.min((audioProgress.currentTime / audioProgress.duration) * 100, 100)}%`;

  if (loading || !text) {
    return <div className="page-feedback">{t('reading.loading')}</div>;
  }

  if (viewMode === 'audio') {
    return (
      <section className="audio-screen">
        <header className="screen-header screen-header--overlay">
          <button type="button" className="icon-chip icon-chip--dark" onClick={() => setViewMode('content')}>
            <ChevronLeft size={20} />
          </button>
          <h2>{t('reading.audioTitle')}</h2>
          <button type="button" className="icon-chip icon-chip--dark">
            <MoreHorizontal size={20} />
          </button>
        </header>

        <div className="audio-artwork">
          <img src={assetUrl('logo-violet.png')} alt="Darija Knowledge AI" />
        </div>

        <div className="audio-meta">
          <strong>{t('reading.audioDarija')}</strong>
          <p>{text.title}</p>
        </div>

        <div className="wave-strip" aria-hidden="true">
          {Array.from({ length: 28 }).map((_, index) => (
            <span
              key={index}
              className={`wave-strip__bar ${isPlaying ? 'is-playing' : ''}`}
              style={{ animationDelay: `${index * 0.06}s`, height: `${18 + ((index * 7) % 32)}px` }}
            />
          ))}
        </div>

        <div className="audio-timeline">
          <span>{formatTime(audioProgress.currentTime)}</span>
          <button
            type="button"
            className="audio-timeline__track"
            ref={timelineTrackRef}
            onClick={handleTimelineSeek}
            aria-label={t('reading.listen')}
          >
            <div className="audio-timeline__progress" style={{ width: timelineProgress }} />
          </button>
          <span>{formatTime(audioProgress.duration)}</span>
        </div>

        <div className="audio-controls">
          <button type="button" className="icon-chip icon-chip--dark" onClick={() => handleSeekBy(-10)}>
            <RotateCcw size={20} />
          </button>
          <button type="button" className="play-button" onClick={speakDarija}>
            {isPlaying ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" />}
          </button>
          <button type="button" className="icon-chip icon-chip--dark" onClick={() => handleSeekBy(10)}>
            <RotateCw size={20} />
          </button>
        </div>

        <div className="rate-card">
          <p>{t('reading.readingSpeed')}</p>
          <div className="rate-row">
            {[0.75, 1, 1.5, 2].map((rate) => (
              <button
                key={rate}
                type="button"
                className={`rate-pill ${playbackRate === rate ? 'is-active' : ''}`}
                onClick={() => setPlaybackRate(rate)}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="screen screen--reading">
      <header className="screen-header">
        <button type="button" className="icon-chip" onClick={onBack}>
          <ChevronLeft size={20} />
        </button>
        <h2>{t('reading.title')}</h2>
        <button type="button" className="icon-chip">
          <MoreHorizontal size={20} />
        </button>
      </header>

      <div className="reading-card reading-card--light">
        <div className="reading-card__header">
          <span>{t('reading.originalText')}</span>
          <button type="button" className="mini-icon" onClick={speakFrench}>
            <Volume2 size={16} />
          </button>
        </div>
        <p>{text.originalText}</p>
      </div>

      <div className="reading-card reading-card--green">
        <div className="reading-card__header">
          <span>{t('reading.darijaText')}</span>
          <button type="button" className="mini-icon mini-icon--green" onClick={speakDarija}>
            <Volume2 size={16} />
          </button>
        </div>
        <p className="text-darija">{text.darijaText}</p>
      </div>

      <button type="button" className="action-button action-button--success" onClick={() => setViewMode('audio')}>
        {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        <span>{t('reading.listen')}</span>
      </button>

      <div className="feature-grid">
        <button type="button" className="feature-card">
          <Sparkles size={18} />
          <span>{t('reading.simplify')}</span>
        </button>
        <button type="button" className="feature-card">
          <Globe size={18} />
          <span>{t('reading.changeLanguage')}</span>
        </button>
        <button type="button" className="feature-card feature-card--wide" onClick={onStartQuiz}>
          <Languages size={18} />
          <span>{t('reading.startQuiz')} {text.generatedQuestions?.length ? `(${text.generatedQuestions.length})` : ''}</span>
        </button>
      </div>
    </section>
  );
};

export default Reading;
