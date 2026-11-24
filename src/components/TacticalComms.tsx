/**
 * Hollow Strike - Real-Time Squad Text Chat & WebRTC Voice Chat Panel
 * Supports embedded Multiplayer Lobby drawer and collapsible in-match HUD mode.
 * Notifies gameplay engine via `onInputFocusChange` so typing pauses WASD/hotkeys cleanly.
 */

import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Mic, MicOff, Send, Volume2, VolumeX, X } from 'lucide-react';
import { ChatChannel } from '../game/types';
import { multiplayerClient } from '../game/multiplayerClient';
import { voiceManager } from '../game/voiceManager';

interface TacticalCommsProps {
  variant: 'embedded' | 'hud';
  compact?: boolean;
  onInputFocusChange?: (focused: boolean) => void;
}

export const TacticalComms: React.FC<TacticalCommsProps> = ({
  variant,
  compact = false,
  onInputFocusChange,
}) => {
  const [, setVersion] = useState(0);
  const [text, setText] = useState('');
  const [handleInput, setHandleInput] = useState(() => multiplayerClient.username || '');
  const [channel, setChannel] = useState<ChatChannel>(multiplayerClient.currentRoom ? 'ROOM' : 'GLOBAL');
  const [hudOpen, setHudOpen] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const u1 = multiplayerClient.subscribe(() => setVersion((v) => v + 1));
    const u2 = voiceManager.subscribe(() => setVersion((v) => v + 1));
    return () => {
      u1();
      u2();
    };
  }, []);

  useEffect(() => {
    if (multiplayerClient.currentRoom && channel === 'GLOBAL') {
      setChannel('ROOM');
    } else if (!multiplayerClient.currentRoom && channel !== 'GLOBAL') {
      setChannel('GLOBAL');
    }
  }, [multiplayerClient.currentRoom]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [multiplayerClient.chatMessages.length, hudOpen]);

  // Enter opens HUD chat quickly on desktop
  useEffect(() => {
    if (variant !== 'hud') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' && !hudOpen && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        setHudOpen(true);
        window.setTimeout(() => inputRef.current?.focus(), 20);
      } else if (e.code === 'Escape' && hudOpen) {
        inputRef.current?.blur();
        setHudOpen(false);
        onInputFocusChange?.(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [variant, hudOpen, onInputFocusChange]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    multiplayerClient.sendChat(clean, multiplayerClient.currentRoom ? channel : 'GLOBAL');
    setText('');
  };

  const handleToggleMic = async () => {
    if (voiceManager.active) {
      voiceManager.leaveVoice();
    } else {
      await voiceManager.joinVoice();
    }
  };

  const activeSpeakers = Object.values(multiplayerClient.voicePeers).filter((p) => p.active);
  const messages = multiplayerClient.chatMessages;
  const inRoom = Boolean(multiplayerClient.currentRoom);
  const canSendChat = multiplayerClient.connected && multiplayerClient.usernameClaimed;

  if (variant === 'hud' && !hudOpen) {
    return (
      <div
        data-testid="hud-comms-bar"
        className={`pointer-events-auto fixed z-30 flex items-center gap-1.5 ${
          compact ? 'left-2 top-[168px]' : 'left-3 bottom-[104px]'
        }`}
      >
        <button
          type="button"
          data-testid="hud-chat-toggle-btn"
          onClick={() => {
            setHudOpen(true);
            window.setTimeout(() => inputRef.current?.focus(), 20);
          }}
          className="flex items-center gap-1.5 border border-[#ECE8E1]/20 bg-[#0F1923]/88 px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase text-[#ECE8E1] hover:border-[#17E5B8] cursor-pointer clip-val-card"
        >
          <MessageSquare className="h-3.5 w-3.5 text-[#17E5B8]" />
          <span>CHAT{messages.length > 0 ? ` (${messages.length})` : ''}</span>
        </button>

        <button
          type="button"
          data-testid="hud-voice-toggle-btn"
          onClick={handleToggleMic}
          title={voiceManager.active ? 'Leave Voice Chat' : 'Join Squad Voice Chat'}
          className={`flex items-center gap-1 border px-2 py-1.5 font-mono text-[10px] font-bold uppercase cursor-pointer clip-val-card ${
            voiceManager.active
              ? voiceManager.muted
                ? 'border-[#FF4655]/60 bg-[#FF4655]/15 text-[#FF4655]'
                : 'border-[#17E5B8]/60 bg-[#17E5B8]/20 text-[#17E5B8]'
              : 'border-[#ECE8E1]/20 bg-[#0F1923]/88 text-[#8B978F] hover:text-[#ECE8E1]'
          }`}
        >
          {voiceManager.active && !voiceManager.muted ? (
            <Mic className={`h-3.5 w-3.5 ${voiceManager.speaking ? 'animate-pulse' : ''}`} />
          ) : (
            <MicOff className="h-3.5 w-3.5" />
          )}
          <span>{voiceManager.active ? (voiceManager.muted ? 'MUTED' : 'LIVE') : 'MIC'}</span>
        </button>

        {voiceManager.active && (
          <button
            type="button"
            onClick={() => voiceManager.toggleMute()}
            className="border border-[#ECE8E1]/20 bg-[#0F1923]/88 px-2 py-1.5 font-mono text-[10px] text-[#ECE8E1] hover:border-[#17E5B8] cursor-pointer clip-val-card"
          >
            {voiceManager.muted ? 'UNMUTE' : 'MUTE'}
          </button>
        )}

        {activeSpeakers.some((p) => p.speaking) && (
          <div className="hidden sm:flex items-center gap-1 border border-[#17E5B8]/40 bg-[#0F1923]/90 px-2 py-1 font-mono text-[9px] text-[#17E5B8]">
            <Volume2 className="h-3 w-3 animate-pulse" />
            <span>
              {activeSpeakers
                .filter((p) => p.speaking)
                .map((p) => p.username)
                .join(', ')}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      data-testid={variant === 'hud' ? 'hud-comms-panel' : 'embedded-comms-panel'}
      className={
        variant === 'hud'
          ? `pointer-events-auto fixed z-40 flex flex-col border border-[#ECE8E1]/25 bg-[#0F1923]/94 p-2.5 shadow-2xl clip-val-card ${
              compact ? 'left-2 top-[118px] w-[265px] max-h-[250px]' : 'left-3 bottom-[104px] w-[320px]'
            }`
          : 'flex flex-col border border-[#ECE8E1]/15 bg-[#0F1923]/85 p-3 clip-val-card'
      }
    >
      {/* Comms Header + Voice Controls */}
      <div className="flex items-center justify-between gap-2 border-b border-[#ECE8E1]/10 pb-2">
        <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#ECE8E1]">
          <MessageSquare className="h-3.5 w-3.5 text-[#17E5B8]" />
          <span>{inRoom ? 'SQUAD COMMS' : 'LOBBY COMMS'}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="comms-voice-join-btn"
            onClick={handleToggleMic}
            className={`flex items-center gap-1 border px-2 py-1 font-mono text-[10px] font-bold uppercase cursor-pointer ${
              voiceManager.active
                ? 'border-[#17E5B8] bg-[#17E5B8]/20 text-[#17E5B8]'
                : 'border-[#ECE8E1]/20 bg-[#18232E] text-[#ECE8E1] hover:border-[#17E5B8]'
            }`}
          >
            {voiceManager.active ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
            {voiceManager.active ? 'LEAVE VOICE' : 'JOIN VOICE'}
          </button>

          {voiceManager.active && (
            <>
              <button
                type="button"
                data-testid="comms-voice-mute-btn"
                onClick={() => voiceManager.toggleMute()}
                className={`border px-2 py-1 font-mono text-[10px] font-bold uppercase cursor-pointer ${
                  voiceManager.muted
                    ? 'border-[#FF4655] bg-[#FF4655]/20 text-[#FF4655]'
                    : 'border-[#ECE8E1]/20 bg-[#18232E] text-[#ECE8E1]'
                }`}
              >
                {voiceManager.muted ? 'UNMUTE' : 'MUTE'}
              </button>
              <button
                type="button"
                onClick={() => voiceManager.toggleDeafen()}
                title={voiceManager.deafened ? 'Undeafen' : 'Deafen audio'}
                className="border border-[#ECE8E1]/20 bg-[#18232E] p-1 text-[#ECE8E1] cursor-pointer"
              >
                {voiceManager.deafened ? <VolumeX className="h-3 w-3 text-[#FF4655]" /> : <Volume2 className="h-3 w-3 text-[#17E5B8]" />}
              </button>
            </>
          )}

          {variant === 'hud' && (
            <button
              type="button"
              onClick={() => {
                onInputFocusChange?.(false);
                setHudOpen(false);
              }}
              className="border border-[#ECE8E1]/20 bg-[#18232E] p-1 text-[#8B978F] hover:text-[#ECE8E1] cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Active Voice Peers Strip */}
      {activeSpeakers.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1 border-b border-[#ECE8E1]/10 pb-1.5">
          {activeSpeakers.map((peer) => (
            <span
              key={peer.username}
              className={`flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[9px] uppercase ${
                peer.speaking
                  ? 'border-[#17E5B8] bg-[#17E5B8]/20 text-[#17E5B8]'
                  : peer.muted
                    ? 'border-[#FF4655]/40 bg-[#FF4655]/10 text-[#FF4655]'
                    : 'border-[#ECE8E1]/15 bg-[#18232E] text-[#ECE8E1]'
              }`}
            >
              {peer.muted ? <MicOff className="h-2.5 w-2.5" /> : <Mic className="h-2.5 w-2.5" />}
              @{peer.username}
            </span>
          ))}
        </div>
      )}

      {/* Voice Permission / Room Hint */}
      {voiceManager.error && (
        <div className="mt-1.5 flex items-center justify-between gap-2 border border-[#FF4655]/40 bg-[#FF4655]/10 px-2 py-1 font-mono text-[10px] text-[#FF4655]">
          <span className="truncate">{voiceManager.error}</span>
          <button type="button" onClick={() => voiceManager.clearError()} className="underline shrink-0 cursor-pointer">
            OK
          </button>
        </div>
      )}

      {/* Message History */}
      <div
        ref={listRef}
        className={`mt-2 space-y-1 overflow-y-auto pr-1 font-mono text-[11px] ${
          variant === 'hud' ? 'h-28' : 'h-32'
        }`}
      >
        {messages.length === 0 ? (
          <div className="py-6 text-center text-[10px] text-[#8B978F]">
            {canSendChat
              ? 'No messages yet. Say hello to your squad.'
              : multiplayerClient.connected
                ? 'Claim a unique handle below to start Text & Voice Comms.'
                : 'Connecting to Tactical Comms server...'}
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="leading-snug break-words">
              <span className="text-[9px] text-[#8B978F] mr-1">
                [{m.channel}]
              </span>
              <span
                className={`font-bold mr-1 ${
                  m.team === 'ATTACKERS'
                    ? 'text-[#FF4655]'
                    : m.team === 'DEFENDERS'
                      ? 'text-[#17E5B8]'
                      : 'text-[#ECE8E1]'
                }`}
              >
                {m.fromUsername}:
              </span>
              <span className="text-[#ECE8E1]/95">{m.text}</span>
            </div>
          ))
        )}
      </div>

      {/* Claim-Handle Prompt or Live Chat Composer */}
      {!canSendChat && multiplayerClient.connected ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (handleInput.trim().length >= 3) {
              multiplayerClient.claimUsername(handleInput.trim());
            }
          }}
          className="mt-2 flex items-center gap-1.5 border-t border-[#ECE8E1]/10 pt-2"
        >
          <input
            ref={inputRef}
            type="text"
            data-testid="comms-claim-input"
            maxLength={18}
            value={handleInput}
            onChange={(e) => setHandleInput(e.target.value)}
            onFocus={() => onInputFocusChange?.(true)}
            onBlur={() => onInputFocusChange?.(false)}
            placeholder="Claim handle (3-18 chars)..."
            className="flex-1 min-w-0 border border-[#ECE8E1]/25 bg-[#18232E] px-2.5 py-1.5 font-mono text-[11px] text-[#ECE8E1] focus:border-[#17E5B8] focus:outline-none"
          />
          <button
            type="submit"
            data-testid="comms-claim-btn"
            disabled={handleInput.trim().length < 3}
            className="shrink-0 bg-[#FF4655] px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase text-[#ECE8E1] hover:opacity-90 disabled:opacity-40 cursor-pointer"
          >
            CLAIM
          </button>
        </form>
      ) : (
        <form onSubmit={handleSend} className="mt-2 flex items-center gap-1.5 border-t border-[#ECE8E1]/10 pt-2">
          {inRoom && (
            <button
              type="button"
              onClick={() => setChannel((c) => (c === 'ROOM' ? 'TEAM' : 'ROOM'))}
              className={`shrink-0 border px-1.5 py-1.5 font-mono text-[9px] font-bold uppercase cursor-pointer ${
                channel === 'TEAM'
                  ? 'border-[#17E5B8]/60 bg-[#17E5B8]/15 text-[#17E5B8]'
                  : 'border-[#ECE8E1]/20 bg-[#18232E] text-[#ECE8E1]'
              }`}
            >
              {channel}
            </button>
          )}
          <input
            ref={inputRef}
            type="text"
            data-testid="comms-chat-input"
            disabled={!canSendChat}
            maxLength={220}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => onInputFocusChange?.(true)}
            onBlur={() => onInputFocusChange?.(false)}
            placeholder={canSendChat ? 'Type tactical message...' : 'Connecting to server...'}
            className="flex-1 min-w-0 border border-[#ECE8E1]/20 bg-[#18232E] px-2.5 py-1.5 font-mono text-[11px] text-[#ECE8E1] focus:border-[#17E5B8] focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            data-testid="comms-chat-send-btn"
            disabled={!canSendChat || !text.trim()}
            className="shrink-0 bg-[#17E5B8] p-2 text-[#0F1923] hover:opacity-90 disabled:opacity-40 cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      )}
      {multiplayerClient.usernameError && !canSendChat && (
        <p className="mt-1 font-mono text-[9px] text-[#FF4655]">{multiplayerClient.usernameError}</p>
      )}
    </div>
  );
};
