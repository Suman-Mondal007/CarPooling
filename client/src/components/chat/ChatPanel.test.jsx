import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatPanel from './ChatPanel.jsx';

// Mock contexts
vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: { _id: 'user_123', name: 'Test User', role: 'EMPLOYEE' }
  })
}));

const mockSocket = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn()
};

vi.mock('../../hooks/useSocket.js', () => ({
  useSocket: () => ({
    socket: mockSocket,
    isConnected: true
  })
}));

vi.mock('../../api/chat.api.js', () => ({
  default: {
    getTripMessages: vi.fn().mockResolvedValue({
      items: [],
      isReadOnly: false
    })
  }
}));

describe('ChatPanel Component - Input Validation', () => {
  it('disables send button when input is empty or only whitespace', () => {
    render(<ChatPanel tripId="trip_1" isOpen={true} />);

    const sendBtn = screen.getByRole('button', { name: /send message/i });
    expect(sendBtn).toBeDisabled();

    const textarea = screen.getByPlaceholderText(/type a message/i);
    fireEvent.change(textarea, { target: { value: '   ' } });

    expect(sendBtn).toBeDisabled();
  });

  it('enforces character counter and permits sending valid text', () => {
    render(<ChatPanel tripId="trip_1" isOpen={true} />);

    const textarea = screen.getByPlaceholderText(/type a message/i);
    fireEvent.change(textarea, { target: { value: 'Hello carpool team!' } });

    expect(screen.getByText('19/1000')).toBeInTheDocument();

    const sendBtn = screen.getByRole('button', { name: /send message/i });
    expect(sendBtn).not.toBeDisabled();

    fireEvent.click(sendBtn);

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'chat:send',
      expect.objectContaining({
        tripId: 'trip_1',
        text: 'Hello carpool team!'
      }),
      expect.any(Function)
    );
  });
});
