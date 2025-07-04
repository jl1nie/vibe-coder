import { useState, useEffect, useRef, useCallback } from 'react';
import { WebRTCClient, WebRTCConnectionState, DEFAULT_WEBRTC_CONFIG } from '@vibe-coder/client';

export interface UseWebRTCConfig {
  signalingServerUrl?: string;
  autoReconnect?: boolean;
  onTerminalOutput?: (output: any) => void;
  onStatusUpdate?: (status: any) => void;
  onError?: (error: Error) => void;
}

export interface UseWebRTCResult {
  state: WebRTCConnectionState;
  connect: (serverId: string) => Promise<void>;
  disconnect: () => void;
  sendCommand: (command: string) => void;
  sendFile: (file: File) => void;
  isSupported: boolean;
}

export function useWebRTC(config: UseWebRTCConfig = {}): UseWebRTCResult {
  const {
    signalingServerUrl = 'https://vibe-coder.space',
    autoReconnect = true,
    onTerminalOutput,
    onStatusUpdate,
    onError,
  } = config;

  const [state, setState] = useState<WebRTCConnectionState>({
    isConnecting: false,
    isConnected: false,
    connectionError: null,
    serverId: null,
    latency: 0,
  });

  const clientRef = useRef<WebRTCClient | null>(null);
  const isSupported = useRef(
    typeof RTCPeerConnection !== 'undefined' && 
    typeof RTCDataChannel !== 'undefined'
  );

  // WebRTCクライアントの初期化
  useEffect(() => {
    if (!isSupported.current) return;

    const client = new WebRTCClient({
      ...DEFAULT_WEBRTC_CONFIG,
      signalingServerUrl,
      serverId: '',
    });

    // イベントリスナーの設定
    client.on('stateChange', (newState: WebRTCConnectionState) => {
      setState(newState);
    });

    client.on('terminalOutput', (output: any) => {
      onTerminalOutput?.(output);
    });

    client.on('statusUpdate', (status: any) => {
      onStatusUpdate?.(status);
    });

    client.on('error', (error: Error) => {
      onError?.(error);
    });

    client.on('connect', () => {
      console.log('WebRTC connection established');
    });

    client.on('disconnect', () => {
      console.log('WebRTC connection closed');
    });

    client.on('connectionLost', () => {
      console.warn('WebRTC connection lost');
      if (autoReconnect) {
        // 自動再接続は WebRTCClient 内で処理される
      }
    });

    clientRef.current = client;

    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current.removeAllListeners();
        clientRef.current = null;
      }
    };
  }, [signalingServerUrl, autoReconnect, onTerminalOutput, onStatusUpdate, onError]);

  // 接続
  const connect = useCallback(async (serverId: string) => {
    if (!clientRef.current) {
      throw new Error('WebRTC client not initialized');
    }

    if (!isSupported.current) {
      throw new Error('WebRTC is not supported in this browser');
    }

    try {
      await clientRef.current.connect(serverId);
    } catch (error) {
      console.error('Connection failed:', error);
      throw error;
    }
  }, []);

  // 切断
  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
    }
  }, []);

  // コマンド送信
  const sendCommand = useCallback((command: string) => {
    if (!clientRef.current) {
      throw new Error('WebRTC client not initialized');
    }

    if (!state.isConnected) {
      throw new Error('Not connected to server');
    }

    try {
      clientRef.current.sendCommand(command);
    } catch (error) {
      console.error('Failed to send command:', error);
      throw error;
    }
  }, [state.isConnected]);

  // ファイル送信
  const sendFile = useCallback((file: File) => {
    if (!clientRef.current) {
      throw new Error('WebRTC client not initialized');
    }

    if (!state.isConnected) {
      throw new Error('Not connected to server');
    }

    try {
      clientRef.current.sendFile(file);
    } catch (error) {
      console.error('Failed to send file:', error);
      throw error;
    }
  }, [state.isConnected]);

  return {
    state,
    connect,
    disconnect,
    sendCommand,
    sendFile,
    isSupported: isSupported.current,
  };
}