import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Send, X, Volume2, VolumeX } from 'lucide-react';
import { useSpeechRecognition, SpeechRecognitionConfig } from '../hooks/useSpeechRecognition';
import { motion, AnimatePresence } from 'framer-motion';

interface VoiceInputProps {
  onSubmit?: (transcript: string) => void;
  onCancel?: () => void;
  placeholder?: string;
  language?: string;
  continuous?: boolean;
  autoSubmit?: boolean;
  className?: string;
  disabled?: boolean;
  showWaveform?: boolean;
}

export function VoiceInput({
  onSubmit,
  onCancel,
  placeholder = '音声でコマンドを入力...',
  language = 'ja-JP',
  continuous = false,
  autoSubmit = false,
  className = '',
  disabled = false,
  showWaveform = true,
}: VoiceInputProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  const config: SpeechRecognitionConfig = {
    language,
    continuous,
    interimResults: true,
    maxAlternatives: 3,
  };

  const {
    state: {
      isListening,
      isSupported,
      transcript,
      interimTranscript,
      finalTranscript,
      error,
      confidence,
    },
    startListening,
    stopListening,
    clearTranscript,
    resetError,
  } = useSpeechRecognition(config);

  // 音声レベル監視
  useEffect(() => {
    if (!isListening || !showWaveform) return;

    let animationFrame: number;
    let audioContext: AudioContext;
    let analyser: AnalyserNode;
    let microphone: MediaStreamAudioSourceNode;
    let dataArray: Uint8Array;

    const setupAudioAnalysis = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMediaStream(stream);

        audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        microphone = audioContext.createMediaStreamSource(stream);
        dataArray = new Uint8Array(analyser.frequencyBinCount);

        microphone.connect(analyser);
        analyser.fftSize = 256;

        const updateAudioLevel = () => {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          setAudioLevel(average / 255);
          
          if (isListening) {
            animationFrame = requestAnimationFrame(updateAudioLevel);
          }
        };

        updateAudioLevel();
      } catch (error) {
        console.error('Audio analysis setup failed:', error);
      }
    };

    setupAudioLevel();

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      if (audioContext) {
        audioContext.close();
      }
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        setMediaStream(null);
      }
    };
  }, [isListening, showWaveform]);

  // 自動送信
  useEffect(() => {
    if (autoSubmit && finalTranscript && !isListening) {
      handleSubmit();
    }
  }, [autoSubmit, finalTranscript, isListening]);

  const handleStart = () => {
    if (!isSupported) {
      alert('お使いのブラウザは音声認識をサポートしていません');
      return;
    }

    if (disabled) return;

    resetError();
    clearTranscript();
    setIsExpanded(true);
    startListening();
  };

  const handleStop = () => {
    stopListening();
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }
  };

  const handleSubmit = () => {
    const textToSubmit = finalTranscript || transcript;
    if (textToSubmit.trim()) {
      onSubmit?.(textToSubmit.trim());
    }
    handleClose();
  };

  const handleClose = () => {
    handleStop();
    setIsExpanded(false);
    clearTranscript();
    onCancel?.();
  };

  const handleRetry = () => {
    resetError();
    clearTranscript();
    startListening();
  };

  // 波形アニメーション用のバー
  const WaveformBars = () => {
    if (!showWaveform) return null;

    const bars = Array.from({ length: 5 }, (_, i) => {
      const height = isListening 
        ? Math.max(0.2, audioLevel + Math.sin(Date.now() * 0.01 + i) * 0.3)
        : 0.2;
      
      return (
        <motion.div
          key={i}
          className="bg-primary-500 rounded-full"
          style={{ width: '3px' }}
          animate={{ height: `${height * 100}%` }}
          transition={{ duration: 0.1, ease: 'easeOut' }}
        />
      );
    });

    return (
      <div className="flex items-center justify-center gap-1 h-6">
        {bars}
      </div>
    );
  };

  return (
    <div className={`voice-input ${className}`}>
      {/* 音声入力ボタン */}
      <AnimatePresence>
        {!isExpanded && (
          <motion.button
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            onClick={handleStart}
            disabled={disabled || !isSupported}
            className={`
              voice-input-button relative p-4 rounded-full transition-all duration-200
              ${isSupported && !disabled
                ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-lg hover:shadow-xl active:scale-95'
                : 'bg-gray-400 text-gray-600 cursor-not-allowed'
              }
              ${isListening ? 'animate-pulse-glow' : ''}
            `}
          >
            {isListening ? (
              <Mic className="w-6 h-6" />
            ) : (
              <MicOff className={`w-6 h-6 ${!isSupported ? 'opacity-50' : ''}`} />
            )}
            
            {/* リップル効果 */}
            {isListening && (
              <div className="absolute inset-0 rounded-full bg-primary-400 animate-ping opacity-30"></div>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* 展開された音声入力UI */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="voice-input-expanded fixed inset-x-4 bottom-4 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50"
          >
            {/* ヘッダー */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${isListening ? 'bg-red-100 dark:bg-red-900' : 'bg-gray-100 dark:bg-gray-700'}`}>
                  {isListening ? (
                    <Mic className="w-5 h-5 text-red-600 dark:text-red-400" />
                  ) : (
                    <MicOff className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {isListening ? '聞き取り中...' : '音声入力'}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {language === 'ja-JP' ? '日本語' : language}
                    {confidence > 0 && ` • 信頼度: ${Math.round(confidence * 100)}%`}
                  </p>
                </div>
              </div>

              <button
                onClick={handleClose}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 波形表示 */}
            {showWaveform && (
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <WaveformBars />
              </div>
            )}

            {/* トランスクリプト表示 */}
            <div className="p-4 min-h-[100px]">
              {error ? (
                <div className="text-center">
                  <div className="text-red-500 dark:text-red-400 mb-2">
                    <VolumeX className="w-8 h-8 mx-auto mb-2" />
                    {error}
                  </div>
                  <button
                    onClick={handleRetry}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    再試行
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {transcript || interimTranscript ? (
                    <div className="text-gray-900 dark:text-white">
                      {/* 確定したテキスト */}
                      {finalTranscript && (
                        <span className="font-medium">{finalTranscript}</span>
                      )}
                      {/* 暫定テキスト */}
                      {interimTranscript && (
                        <span className="text-gray-500 dark:text-gray-400 italic">
                          {interimTranscript}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 dark:text-gray-400">
                      <Volume2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      {isListening ? '何か話してください...' : placeholder}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* アクションボタン */}
            <div className="flex gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
              {!isListening ? (
                <>
                  <button
                    onClick={handleStart}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    <Mic className="w-4 h-4" />
                    録音開始
                  </button>
                  
                  {(transcript || finalTranscript) && (
                    <button
                      onClick={handleSubmit}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                      送信
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={handleStop}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <MicOff className="w-4 h-4" />
                  録音停止
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* サポートされていない場合のメッセージ */}
      {!isSupported && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
          お使いのブラウザは音声認識をサポートしていません
        </div>
      )}
    </div>
  );
}