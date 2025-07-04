import { useState, useEffect, useRef, useCallback } from 'react';

export interface SpeechRecognitionConfig {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  grammars?: SpeechGrammarList;
}

export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  alternatives?: Array<{
    transcript: string;
    confidence: number;
  }>;
}

export interface SpeechRecognitionState {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  finalTranscript: string;
  error: string | null;
  confidence: number;
}

export interface SpeechRecognitionHook {
  state: SpeechRecognitionState;
  startListening: () => void;
  stopListening: () => void;
  clearTranscript: () => void;
  resetError: () => void;
}

export function useSpeechRecognition(
  config: SpeechRecognitionConfig = {}
): SpeechRecognitionHook {
  const {
    language = 'ja-JP',
    continuous = false,
    interimResults = true,
    maxAlternatives = 1,
    grammars,
  } = config;

  const [state, setState] = useState<SpeechRecognitionState>(() => {
    const isSupported = 
      'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;

    return {
      isListening: false,
      isSupported,
      transcript: '',
      interimTranscript: '',
      finalTranscript: '',
      error: null,
      confidence: 0,
    };
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // SpeechRecognition インスタンスの初期化
  useEffect(() => {
    if (!state.isSupported) return;

    const SpeechRecognitionClass = 
      window.SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) return;

    const recognition = new SpeechRecognitionClass();
    
    // 設定の適用
    recognition.lang = language;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.maxAlternatives = maxAlternatives;

    if (grammars) {
      recognition.grammars = grammars;
    }

    // イベントハンドラーの設定
    recognition.onstart = () => {
      setState(prev => ({
        ...prev,
        isListening: true,
        error: null,
      }));
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';
      let confidence = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += transcript;
          confidence = result[0].confidence;
        } else {
          interimTranscript += transcript;
        }
      }

      setState(prev => ({
        ...prev,
        transcript: finalTranscript || interimTranscript,
        interimTranscript,
        finalTranscript: prev.finalTranscript + finalTranscript,
        confidence,
      }));
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      let errorMessage = 'Speech recognition error';

      switch (event.error) {
        case 'no-speech':
          errorMessage = '音声が検出されませんでした';
          break;
        case 'audio-capture':
          errorMessage = 'マイクにアクセスできません';
          break;
        case 'not-allowed':
          errorMessage = 'マイクの使用が許可されていません';
          break;
        case 'network':
          errorMessage = 'ネットワークエラーが発生しました';
          break;
        case 'service-not-allowed':
          errorMessage = '音声認識サービスが利用できません';
          break;
        case 'bad-grammar':
          errorMessage = '音声認識の設定にエラーがあります';
          break;
        case 'language-not-supported':
          errorMessage = '指定された言語はサポートされていません';
          break;
        default:
          errorMessage = `音声認識エラー: ${event.error}`;
      }

      setState(prev => ({
        ...prev,
        isListening: false,
        error: errorMessage,
      }));
    };

    recognition.onend = () => {
      setState(prev => ({
        ...prev,
        isListening: false,
      }));
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognition) {
        recognition.abort();
      }
    };
  }, [language, continuous, interimResults, maxAlternatives, grammars, state.isSupported]);

  // 音声認識開始
  const startListening = useCallback(() => {
    if (!recognitionRef.current || state.isListening) return;

    try {
      recognitionRef.current.start();
      
      // タイムアウトの設定（30秒で自動停止）
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        if (recognitionRef.current && state.isListening) {
          recognitionRef.current.stop();
        }
      }, 30000);

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'マイクの使用許可が必要です',
      }));
    }
  }, [state.isListening]);

  // 音声認識停止
  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !state.isListening) return;

    recognitionRef.current.stop();

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [state.isListening]);

  // トランスクリプトクリア
  const clearTranscript = useCallback(() => {
    setState(prev => ({
      ...prev,
      transcript: '',
      interimTranscript: '',
      finalTranscript: '',
      confidence: 0,
    }));
  }, []);

  // エラーリセット
  const resetError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
    }));
  }, []);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  return {
    state,
    startListening,
    stopListening,
    clearTranscript,
    resetError,
  };
}