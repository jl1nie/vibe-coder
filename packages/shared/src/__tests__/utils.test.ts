import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateSessionId,
  generateHostId,
  isValidSessionId,
  isValidHostId,
  formatTimestamp,
  sanitizeCommand,
  isCommandSafe,
  validatePlaylistJSON,
  debounce,
  throttle,
  retry,
  parseClaudeCodeCommand,
  formatFileSize,
  createEventEmitter,
} from '../utils';

describe('ID Generation', () => {
  it('should generate valid session ID', () => {
    const sessionId = generateSessionId();
    expect(sessionId).toMatch(/^[A-Z0-9]{8}$/);
  });

  it('should generate valid host ID', () => {
    const hostId = generateHostId();
    expect(hostId).toMatch(/^[0-9]{8}$/);
  });

  it('should generate unique IDs', () => {
    const id1 = generateSessionId();
    const id2 = generateSessionId();
    expect(id1).not.toBe(id2);
  });
});

describe('ID Validation', () => {
  it('should validate session IDs correctly', () => {
    expect(isValidSessionId('ABCD1234')).toBe(true);
    expect(isValidSessionId('12345678')).toBe(true);
    expect(isValidSessionId('abcd1234')).toBe(false); // lowercase
    expect(isValidSessionId('ABCD123')).toBe(false); // too short
    expect(isValidSessionId('ABCD12345')).toBe(false); // too long
    expect(isValidSessionId('')).toBe(false);
  });

  it('should validate host IDs correctly', () => {
    expect(isValidHostId('12345678')).toBe(true);
    expect(isValidHostId('00000000')).toBe(true);
    expect(isValidHostId('ABCD1234')).toBe(false); // contains letters
    expect(isValidHostId('1234567')).toBe(false); // too short
    expect(isValidHostId('123456789')).toBe(false); // too long
    expect(isValidHostId('')).toBe(false);
  });
});

describe('Timestamp Formatting', () => {
  it('should format timestamp correctly', () => {
    const timestamp = new Date('2024-01-01T12:34:56').getTime();
    const formatted = formatTimestamp(timestamp);
    expect(formatted).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});

describe('Command Security', () => {
  it('should sanitize commands', () => {
    expect(sanitizeCommand('ls -la')).toBe('ls -la');
    expect(sanitizeCommand('  ls -la  ')).toBe('ls -la');
    expect(sanitizeCommand('ls & rm -rf /')).toBe('ls  rm -rf /');
    expect(sanitizeCommand('ls; echo "test"')).toBe('ls echo "test"');
  });

  it('should detect safe commands', () => {
    expect(isCommandSafe('claude-code help')).toBe(true);
    expect(isCommandSafe('npm install')).toBe(true);
    expect(isCommandSafe('ls -la')).toBe(true);
    expect(isCommandSafe('git status')).toBe(true);
  });

  it('should detect dangerous commands', () => {
    expect(isCommandSafe('rm -rf /')).toBe(false);
    expect(isCommandSafe('sudo rm file')).toBe(false);
    expect(isCommandSafe('chmod 777 /')).toBe(false);
    expect(isCommandSafe('ls && rm file')).toBe(false);
    expect(isCommandSafe('unknown-command')).toBe(false);
  });
});

describe('Playlist Validation', () => {
  const validPlaylist = {
    schema: 'vibe-coder-playlist-v1',
    metadata: {
      name: 'Test Playlist',
      author: 'Test Author',
      version: '1.0.0',
    },
    commands: [
      {
        icon: '🔐',
        label: 'Test',
        command: 'test command',
      },
    ],
  };

  it('should validate correct playlist', () => {
    expect(validatePlaylistJSON(validPlaylist)).toBe(true);
  });

  it('should reject invalid playlists', () => {
    expect(validatePlaylistJSON(null)).toBe(false);
    expect(validatePlaylistJSON({})).toBe(false);
    expect(validatePlaylistJSON({ schema: 'wrong-schema' })).toBe(false);
    expect(validatePlaylistJSON({ 
      ...validPlaylist, 
      commands: 'not-an-array' 
    })).toBe(false);
    expect(validatePlaylistJSON({
      ...validPlaylist,
      commands: [{ icon: '🔐' }] // missing required fields
    })).toBe(false);
  });
});

describe('Utility Functions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should debounce function calls', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    debouncedFn();
    debouncedFn();

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should throttle function calls', () => {
    const fn = vi.fn();
    const throttledFn = throttle(fn, 100);

    throttledFn();
    throttledFn();
    throttledFn();

    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    throttledFn();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should retry failed functions', async () => {
    vi.useRealTimers();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValueOnce('success');

    const result = await retry(fn, 3, 0);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should give up after max retries', async () => {
    vi.useRealTimers();
    const fn = vi.fn().mockRejectedValue(new Error('always fail'));

    await expect(retry(fn, 2, 0)).rejects.toThrow('always fail');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('Claude Code Command Parsing', () => {
  it('should parse commands correctly', () => {
    expect(parseClaudeCodeCommand('add authentication'))
      .toBe('claude-code "add authentication"');
    
    expect(parseClaudeCodeCommand('claude-code help'))
      .toBe('claude-code help');
    
    expect(parseClaudeCodeCommand('  fix bug  '))
      .toBe('claude-code "fix bug"');
  });
});

describe('File Size Formatting', () => {
  it('should format file sizes correctly', () => {
    expect(formatFileSize(0)).toBe('0 Bytes');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1024 * 1024)).toBe('1 MB');
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });
});

describe('Event Emitter', () => {
  it('should emit and listen to events', () => {
    const emitter = createEventEmitter<{ test: string; number: number }>();
    const listener = vi.fn();

    emitter.on('test', listener);
    emitter.emit('test', 'hello');

    expect(listener).toHaveBeenCalledWith('hello');
  });

  it('should remove listeners', () => {
    const emitter = createEventEmitter<{ test: string }>();
    const listener = vi.fn();

    emitter.on('test', listener);
    emitter.off('test', listener);
    emitter.emit('test', 'hello');

    expect(listener).not.toHaveBeenCalled();
  });

  it('should handle once listeners', () => {
    const emitter = createEventEmitter<{ test: string }>();
    const listener = vi.fn();

    emitter.once('test', listener);
    emitter.emit('test', 'hello1');
    emitter.emit('test', 'hello2');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('hello1');
  });
});