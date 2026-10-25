import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  MessageSquare,
  Search,
  Clock,
  Loader2,
  Lock,
  ArrowRight
} from 'lucide-react';
import chatApi from '../../api/chat.api.js';
import ChatPanel from '../../components/chat/ChatPanel.jsx';


export function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTripId = searchParams.get('tripId');

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await chatApi.getConversations();
      const items = data?.items || [];
      setConversations(items);

      // Default select first conversation if none selected in URL
      if (!selectedTripId && items.length > 0) {
        setSearchParams({ tripId: items[0].tripId }, { replace: true });
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTripId, setSearchParams]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleSelectConversation = (tripId) => {
    setSearchParams({ tripId });
  };

  const filteredConversations = conversations.filter((c) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const origin = c.ride?.originAddress?.toLowerCase() || '';
    const dest = c.ride?.destinationAddress?.toLowerCase() || '';
    const lastMsg = c.lastMessage?.content?.toLowerCase() || '';
    const driver = c.ride?.driver?.name?.toLowerCase() || '';
    return origin.includes(term) || dest.includes(term) || lastMsg.includes(term) || driver.includes(term);
  });

  const selectedConversation = conversations.find(
    (c) => c.tripId?.toString() === selectedTripId?.toString()
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <MessageSquare className="w-7 h-7 text-teal-400" />
          Trip Communications
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Coordinate pickup details and stay connected with verified carpool participants.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[720px]">
        {/* Left: Conversation List */}
        <div className="lg:col-span-5 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {/* Search bar */}
          <div className="p-3.5 border-b border-slate-800 bg-slate-950/40">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search rides or messages..."
                className="w-full pl-9 pr-3.5 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {loading ? (
              <div className="h-full flex items-center justify-center p-8 text-slate-500 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
                <span className="text-xs">Loading conversations...</span>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <p className="text-sm font-medium text-slate-300">No conversations found</p>
                <p className="text-xs text-slate-500 mt-1">
                  Chat becomes available once you book or offer a ride.
                </p>
                <div className="mt-4 flex justify-center gap-3">
                  <Link
                    to="/find-ride"
                    className="text-xs px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20 transition"
                  >
                    Find a Ride
                  </Link>
                  <Link
                    to="/offer-ride"
                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                  >
                    Offer a Ride
                  </Link>
                </div>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isSelected = c.tripId?.toString() === selectedTripId?.toString();
                const depTime = c.ride?.departureAt
                  ? new Date(c.ride.departureAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : null;

                return (
                  <button
                    key={c.tripId}
                    onClick={() => handleSelectConversation(c.tripId)}
                    className={`w-full text-left p-4 transition flex flex-col gap-2 ${
                      isSelected
                        ? 'bg-teal-500/10 border-l-4 border-teal-500'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
                            c.isDriver
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {c.isDriver ? 'Driver' : 'Passenger'}
                        </span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {depTime}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {c.isReadOnly && (
                          <Lock className="w-3.5 h-3.5 text-slate-500" title="Read only" />
                        )}
                        {c.unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-teal-500 text-slate-950 font-bold text-[10px]">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Route preview */}
                    <div className="text-xs font-medium text-slate-200 truncate flex items-center gap-1.5">
                      <span className="truncate">{c.ride?.originAddress || 'Origin'}</span>
                      <ArrowRight className="w-3 h-3 shrink-0 text-slate-500" />
                      <span className="truncate text-teal-300">
                        {c.ride?.destinationAddress || 'Destination'}
                      </span>
                    </div>

                    {/* Last message snippet */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <p className="truncate max-w-[240px]">
                        {c.lastMessage ? (
                          <>
                            <span className="font-medium text-slate-300">
                              {c.lastMessage.sender?.name}:
                            </span>{' '}
                            {c.lastMessage.content}
                          </>
                        ) : (
                          <span className="italic text-slate-500">No messages yet</span>
                        )}
                      </p>
                      {c.lastMessage?.createdAt && (
                        <span className="text-[10px] text-slate-500 shrink-0">
                          {new Date(c.lastMessage.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Message Thread */}
        <div className="lg:col-span-7 flex flex-col h-full">
          {selectedTripId ? (
            <ChatPanel
              tripId={selectedTripId}
              isOpen={true}
              isEmbedded={true}
              title={
                selectedConversation?.ride
                  ? `${selectedConversation.ride.originAddress?.split(',')[0]} → ${selectedConversation.ride.destinationAddress?.split(',')[0]}`
                  : 'Trip Chat'
              }
              subtitle={
                selectedConversation?.ride?.departureAt
                  ? `Departure: ${new Date(selectedConversation.ride.departureAt).toLocaleString()}`
                  : null
              }
            />
          ) : (
            <div className="h-full bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center p-8 text-center text-slate-500">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700/50 flex items-center justify-center text-slate-400 mb-3">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-slate-300">Select a conversation</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Pick a ride from the list on the left to start coordinating with your fellow commuters.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChatPage;
