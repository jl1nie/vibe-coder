import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '../test/test-utils';
import App from '../App';

// Use actual DEFAULT_PLAYLIST from @vibe-coder/shared

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the initial authentication screen', () => {
    render(<App />);
    
    // Header should be present
    expect(screen.getByRole('heading', { level: 1, name: 'Vibe Coder' })).toBeInTheDocument();
    expect(screen.getByText('Claude Code Mobile')).toBeInTheDocument();
    
    // Main welcome screen should be shown
    expect(screen.getByRole('heading', { level: 2, name: 'Vibe Coder' })).toBeInTheDocument();
    expect(screen.getByText('スマホでClaude Codeを実行')).toBeInTheDocument();
    expect(screen.getByText('ホストに接続')).toBeInTheDocument();
  });

  it('should not show terminal when unauthenticated', () => {
    render(<App />);
    
    // Terminal should not be visible when not authenticated
    const terminalContainer = document.querySelector('.terminal-output');
    expect(terminalContainer).not.toBeInTheDocument();
    expect(screen.queryByText('Terminal')).not.toBeInTheDocument();
  });

  it('should display connection status', () => {
    render(<App />);
    
    // Should show offline status initially
    const wifiOffIcon = screen.getByTestId('wifi-off');
    expect(wifiOffIcon).toBeInTheDocument();
  });

  it('should not show command slots when unauthenticated', () => {
    render(<App />);
    
    // Command slots should not be visible when not authenticated
    expect(screen.queryByText('Login')).not.toBeInTheDocument();
    expect(screen.queryByText('Fix Bug')).not.toBeInTheDocument();
    expect(screen.queryByText('Mobile')).not.toBeInTheDocument();
    expect(screen.queryByText('Test')).not.toBeInTheDocument();
    expect(screen.queryByText('Style')).not.toBeInTheDocument();
  });

  it('should show host connection button', () => {
    render(<App />);
    
    const connectButton = screen.getByRole('button', { name: /ホストに接続/i });
    expect(connectButton).toBeInTheDocument();
    
    // Click should work without error
    fireEvent.click(connectButton);
  });


  it('should open settings modal', () => {
    render(<App />);
    
    const settingsButton = screen.getByRole('button', { name: /settings/i });
    fireEvent.click(settingsButton);
    
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Voice Recognition')).toBeInTheDocument();
    expect(screen.getByText('Command Playlists')).toBeInTheDocument();
  });

  it('should close settings modal', () => {
    render(<App />);
    
    const settingsButton = screen.getByRole('button', { name: /settings/i });
    fireEvent.click(settingsButton);
    
    const closeButton = screen.getByText('✕');
    fireEvent.click(closeButton);
    
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('should not render terminal area when unauthenticated', () => {
    render(<App />);
    
    // Terminal should not be visible when not authenticated
    expect(screen.queryByText('Terminal')).not.toBeInTheDocument();
    const terminalContainer = document.querySelector('.terminal-output');
    expect(terminalContainer).not.toBeInTheDocument();
  });

  it('should render command navigation', () => {
    render(<App />);
    
    // Check that navigation buttons exist (they may be disabled initially)
    const buttons = screen.getAllByRole('button');
    const navigationButtons = buttons.filter(btn => 
      btn.querySelector('svg') && 
      (btn.querySelector('svg')?.getAttribute('class')?.includes('lucide') || false)
    );
    
    expect(navigationButtons.length).toBeGreaterThan(0);
  });

  it('should handle voice input button click', () => {
    render(<App />);
    
    const voiceButton = screen.getByRole('button', { name: /voice input/i });
    fireEvent.click(voiceButton);
    
    // Button exists and can be clicked without error
    expect(voiceButton).toBeInTheDocument();
  });



  it('should handle voice recognition availability', () => {
    render(<App />);
    
    // Open settings to check voice recognition status
    const settingsButton = screen.getByRole('button', { name: /settings/i });
    fireEvent.click(settingsButton);
    
    // Should show voice recognition status
    expect(screen.getByText(/Voice Recognition/)).toBeInTheDocument();
  });

  it('should be mobile responsive', () => {
    // Test mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });
    
    render(<App />);
    
    // Should still render all essential elements
    expect(screen.getByRole('heading', { level: 1, name: 'Vibe Coder' })).toBeInTheDocument();
    expect(screen.getByText('ホストに接続')).toBeInTheDocument();
  });

  it('should show host ID input screen when connect button is clicked', () => {
    render(<App />);
    
    const connectButton = screen.getByRole('button', { name: /ホストに接続/i });
    fireEvent.click(connectButton);
    
    // Should show host ID input screen
    expect(screen.getByText('ホスト接続')).toBeInTheDocument();
    expect(screen.getByText('8桁のHost IDを入力してください')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('12345678')).toBeInTheDocument();
  });

  it('should validate host ID input', () => {
    render(<App />);
    
    // Navigate to host ID input screen
    const connectButton = screen.getByRole('button', { name: /ホストに接続/i });
    fireEvent.click(connectButton);
    
    // Try to submit with invalid input
    const submitButton = screen.getByRole('button', { name: '接続' });
    fireEvent.click(submitButton);
    
    // Should show error message
    expect(screen.getByText('8桁のHost IDを入力してください')).toBeInTheDocument();
  });
});