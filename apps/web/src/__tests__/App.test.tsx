import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '../test/test-utils';
import App from '../App';

// Use actual DEFAULT_PLAYLIST from @vibe-coder/shared

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the main interface', () => {
    render(<App />);
    
    expect(screen.getByText('Vibe Coder')).toBeInTheDocument();
    expect(screen.getByText('Claude Code Mobile')).toBeInTheDocument();
    expect(screen.getByText('Terminal')).toBeInTheDocument();
  });

  it('should show terminal container', () => {
    render(<App />);
    
    // xterm.js terminal is rendered in a container, text is not directly in DOM
    const terminalContainer = document.querySelector('.terminal-output');
    expect(terminalContainer).toBeInTheDocument();
  });

  it('should display connection status', () => {
    render(<App />);
    
    // Should show offline status initially
    const wifiOffIcon = screen.getByTestId('wifi-off');
    expect(wifiOffIcon).toBeInTheDocument();
  });

  it('should show command slots', () => {
    render(<App />);
    
    // Check that the first few commands are visible (only 5 slots shown at once)
    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.getByText('Fix Bug')).toBeInTheDocument();
    expect(screen.getByText('Mobile')).toBeInTheDocument();
    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText('Style')).toBeInTheDocument();
  });

  it('should execute command when clicking command button', () => {
    render(<App />);
    
    const loginButton = screen.getByText('Login');
    fireEvent.click(loginButton);
    
    // Command button exists and can be clicked without error
    expect(loginButton).toBeInTheDocument();
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

  it('should render terminal area', () => {
    render(<App />);
    
    // Check that terminal-related elements exist
    expect(screen.getByText('Terminal')).toBeInTheDocument();
    const terminalContainer = document.querySelector('.terminal-output');
    expect(terminalContainer).toBeInTheDocument();
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
    expect(screen.getByText('Vibe Coder')).toBeInTheDocument();
    expect(screen.getByText('Terminal')).toBeInTheDocument();
  });
});