import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, X, MessageSquare, AlertCircle, Loader2, Lock, Clock, User } from 'lucide-react';
import { useSocket } from '../../hooks/useSocket.js';
import { useAuth } from '../../context/AuthContext.jsx';
import chatApi from '../../api/chat.api.js';

export function ChatPanel({
  tripId,
  isOpen = true,
  onClose,
  isEmbedded = false,
  title = 'Trip Chat',
  subtitle = null
}) {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  }, []);

  // Fetch initial message history via REST
  const loadMessages = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await chatApi.getTripMessages(tripId, { limit: 100 });
      setMessages(data?.items || []);
      setIsReadOnly(Boolean(data?.isReadOnly));
      setTimeout(() => scrollToBottom(false), 50);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not load messages');
    } finally {
      setLoading(false);
    }
  }, [tripId, scrollToBottom]);

  useEffect(() => {
    if (isOpen && tripId) {
      loadMessages();
    }
  }, [isOpen, tripId, loadMessages]);

  // Join trip room and listen for real-time messages
  useEffect(() => {
    if (!socket || !tripId || !isOpen) return;

    socket.emit('trip:join', { tripId });
    socket.emit('chat:read', { tripId });

    const handleNewMessage = (newMsg) => {
      const msgTripId = newMsg.trip?._id || newMsg.trip;
      if (msgTripId?.toString() === tripId?.toString()) {
        setMessages((prev) => {
          // Avoid duplicate messages
          if (prev.some((m) => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });
        socket.emit('chat:read', { tripId });
        setTimeout(() => scrollToBottom(true), 50);
      }
    };

    const handleChatRead = ({ userId }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (!m.readBy?.includes(userId)) {
            return { ...m, readBy: [...(m.readBy || []), userId] };
          }
          return m;
        })
      );
    };

    const handleChatError = (err) => {
      if (err?.error?.message) {
        setError(err.error.message);
      }
    };

    socket.on('chat:message', handleNewMessage);
    socket.on('chat:read', handleChatRead);
    socket.on('chat:error', handleChatError);

    return () => {
      socket.off('chat:message', handleNewMessage);
      socket.off('chat:read', handleChatRead);
      socket.off('chat:error', handleChatError);
    };
  }, [socket, tripId, isOpen, scrollToBottom]);

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (isReadOnly || !inputText.trim() || sending) return;

    const trimmed = inputText.trim();
    if (trimmed.length > 1000) {
      setError('Message exceeds 1000 characters');
      return;
    }

    setSending(true);
    setError(null);

    if (socket && isConnected) {
      socket.emit('chat:send', { tripId, text: trimmed }, (response) => {
        setSending(false);
        if (response?.success) {
          setInputText('');
          setTimeout(() => scrollToBottom(true), 50);
        } else {
          setError(response?.error?.message || 'Failed to send message');
        }
      });
    } else {
      setSending(false);
      setError('Real-time connection unavailable. Reconnecting...');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen && !isEmbedded) return null;

  return (
    <div
      className={`flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl ${
        isEmbedded ? 'h-[500px] w-full' : 'h-[600px] w-full max-w-md'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              {title}
              {isReadOnly && (
                <span className="inline-flex items-center gap-1 text-[11px] font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  <Lock className="w-3 h-3" /> Read-only
                </span>
              )}
            </h3>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Close Chat"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="px-4 py-2.5 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-900/50">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
            <span className="text-xs">Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center mb-3 text-slate-400">
              <MessageSquare className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-300">No messages yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Say hello or coordinate pickup details with your carpool team!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = (msg.sender?._id || msg.sender)?.toString() === user?._id?.toString();
            const senderName = isMine ? 'You' : msg.sender?.name || 'Participant';
            const timeStr = new Date(msg.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div
                key={msg._id}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
              >
                {!isMine && (
                  <span className="text-[11px] font-medium text-slate-400 mb-1 ml-1 flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-500" />
                    {senderName}
                  </span>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm text-sm break-words ${
                    isMine
                      ? 'bg-teal-600 text-white rounded-br-xs'
                      : 'bg-slate-800 text-slate-100 border border-slate-700/50 rounded-bl-xs'
                  }`}
                >
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  <div
                    className={`flex items-center justify-end gap-1 text-[10px] mt-1 ${
                      isMine ? 'text-teal-200' : 'text-slate-400'
                    }`}
                  >
                    <Clock className="w-2.5 h-2.5" />
                    <span>{timeStr}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/70">
        {isReadOnly ? (
          <div className="py-2.5 px-3 bg-slate-900 border border-slate-800 rounded-xl text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span>Chat is closed 24 hours after completion or cancellation.</span>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="space-y-1.5">
            <div className="relative flex items-center">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message (Press Enter to send)..."
                rows={1}
                maxLength={1000}
                disabled={sending || !isConnected}
                className="w-full resize-none pl-3.5 pr-12 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ minHeight: '42px', maxHeight: '100px' }}
              />
              <button
                type="submit"
                disabled={!inputText.trim() || sending || !isConnected}
                className="absolute right-2 p-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 disabled:opacity-30 disabled:hover:bg-teal-500 transition"
                aria-label="Send message"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex justify-between items-center px-1 text-[11px] text-slate-500">
              <span>Shift+Enter for new line</span>
              <span className={inputText.length >= 950 ? 'text-amber-400' : ''}>
                {inputText.length}/1000
              </span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default ChatPanel;
