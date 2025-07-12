// Simple test to verify Jest setup

import { MessageType, MessagePriority } from '../types';

describe('Simple Communication Test', () => {
  test('should import types correctly', () => {
    expect(MessageType.HEARTBEAT).toBe('heartbeat');
    expect(MessagePriority.NORMAL).toBe(2);
  });

  test('should have basic functionality', () => {
    expect(1 + 1).toBe(2);
  });
}); 