/**
 * Hollow Strike - Main Application Entry
 * Full-viewport tactical Game Shell with Three.js engine lifecycle,
 * mobile landscape lock, cross-platform controls, 3-slot weapons, and live WebSocket multiplayer matches.
 */

import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './game/gameEngine';
import { isMobileDevice } from './game/device';
import { soundEngine } from './game/audio';
import {
  loadProfile,
  loadSavedMapId,
  loadSavedSettings,
  recordMatchToProfile,
  resetProfileData,
  saveProfile,
  saveSelectedMapId,
  saveSettingsToStorage,
} from './game/profileStore';
import { resolveMapDef, setActiveMap } from './game/mapData';
import { clampTeamSizeForMap, getTdmKillTarget, isTdmMap } from './game/rules';
import { multiplayerClient } from './game/multiplayerClient';
import { voiceManager } from './game/voiceManager';
import {
  AbilitySlotState,
  AGENT_REGISTRY,
  BotDifficulty,
  CustomRoomState,
  DEFAULT_KEY_BINDINGS,
  GameSettings,
  HitFeedback,
  KillEvent,
  MatchMode,
  PlayerProfile,
  PlayerStats,
  RoundPhase,
  SpectateState,
  TeamSide,
  TrainingSessionState,
  WEAPON_REGISTRY,
  WeaponDef,
} from './game/types';
import { LobbyScreen } from './components/LobbyScreen';
import { GameHUD } from './components/GameHUD';
import { TrainingHUD } from './components/TrainingHUD';
import { MobileControls } from './components/MobileControls';
import { BuyMenu } from './components/BuyMenu';
import { ScoreboardModal } from './components/ScoreboardModal';
import { SettingsModal } from './components/SettingsModal';
import { MatchEndModal } from './components/MatchEndModal';
import { PauseModal } from './components/PauseModal';
import { OrientationGuard } from './components/OrientationGuard';
import { TacticalMapModal } from './components/TacticalMapModal';
import { LoadingSplash } from './components/LoadingSplash';
import { PreMatchPlayer, PreMatchScreen } from './components/PreMatchScreen';
import { GlobalLeaderboardModal } from './components/GlobalLeaderboardModal';
import {
  auth,
  onAuthStateChanged,
  saveMatchSummaryToFirestore,
  syncUserProfileWithFirestore,
  User,
} from './firebase';
import { MatchSummaryPayload } from './game/profileStore';

type AppState = 'title' | 'prematch' | 'playing' | 'paused' | 'gameover';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const hitmarkerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hitFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const damageFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persistent Player Profile & Settings
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile());
  const [settings, setSettings] = useState<GameSettings>(() =>
    loadSavedSettings({
      graphics: 'HIGH',
      fpsCap: 60,
      showFps: true,
      mouseSensitivity: 0.0022,
      touchSensitivity: 0.0035,
      adsSensitivityMultiplier: 0.7,
      invertY: false,
      fov: 90,
      crosshairColor: 'cyan',
      crosshairSize: 'medium',
      volume: 0.7,
      soundEnabled: true,
      autoFireMobile: false,
      aimAssistMobile: true,
      touchScale: 1.0,
      touchOpacity: 0.85,
      controlMode: 'AUTO',
      keyBindings: { ...DEFAULT_KEY_BINDINGS },
    })
  );

  // App Shell State
  const [isBootLoading, setIsBootLoading] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('autostart') !== '1';
  });
  const [appState, setAppState] = useState<AppState>('title');
  const [selectedAgentId, setSelectedAgentId] = useState<string>(() => profile.favoriteAgentId || 'KAEL');
  const [selectedMapId, setSelectedMapId] = useState<string>(() => {
    const saved = loadSavedMapId();
    setActiveMap(saved);
    return saved;
  });
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('MEDIUM');
  const [tdmTeamSize, setTdmTeamSize] = useState<1 | 2>(2);
  const [tdmKillTarget, setTdmKillTarget] = useState<number>(25);
  const [lastMatchMode, setLastMatchMode] = useState<MatchMode>('CUSTOM');
  const [lastAllyBotIds, setLastAllyBotIds] = useState<string[]>([]);
  const [activeRoom, setActiveRoom] = useState<CustomRoomState | null>(null);
  const [trainingState, setTrainingState] = useState<TrainingSessionState | null>(null);
  const pendingLaunchRef = useRef<{
    mode: MatchMode;
    customRoom: CustomRoomState | null;
    allyBotAgentIds: string[];
    mapId: string;
    tdmTeamSize: 1 | 2;
  } | null>(null);
  const [prematchRoster, setPrematchRoster] = useState<{
    mode: MatchMode;
    mapId: string;
    tdmTeamSize?: 1 | 2;
    playerTeam: TeamSide;
    defenders: PreMatchPlayer[];
    attackers: PreMatchPlayer[];
  } | null>(null);

  // Modals & Comms Focus
  const [showBuyMenu, setShowBuyMenu] = useState<boolean>(false);
  const [showMapModal, setShowMapModal] = useState<boolean>(false);
  const [showScoreboard, setShowScoreboard] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [isChatFocused, setIsChatFocused] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(() => auth.currentUser);
  const [lastMatchSummary, setLastMatchSummary] = useState<MatchSummaryPayload | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const synced = await syncUserProfileWithFirestore(user, profile);
          setProfile(synced);
        } catch (err) {
          console.warn('[Firebase] Profile sync on auth change warning:', err);
        }
      }
    });
  }, []);

  // Live HUD States
  const [hp, setHp] = useState<number>(100);
  const [armor, setArmor] = useState<number>(0);
  const [currentWeapon, setCurrentWeapon] = useState<WeaponDef>(WEAPON_REGISTRY.KADENCE);
  const [ammoInMag, setAmmoInMag] = useState<number>(12);
  const [reserveAmmo, setReserveAmmo] = useState<number>(36);
  const [isReloading, setIsReloading] = useState<boolean>(false);
  const [activeSlot, setActiveSlot] = useState<1 | 2 | 3>(2);
  const [roundPhase, setRoundPhase] = useState<RoundPhase>('BUY_PHASE');
  const [roundTimeRemaining, setRoundTimeRemaining] = useState<number>(15);
  const [attackerRoundsWon, setAttackerRoundsWon] = useState<number>(0);
  const [defenderRoundsWon, setDefenderRoundsWon] = useState<number>(0);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [killFeed, setKillFeed] = useState<KillEvent[]>([]);
  const [hitmarker, setHitmarker] = useState<{ active: boolean; isHeadshot: boolean } | null>(null);
  const [hitFeedback, setHitFeedback] = useState<HitFeedback | null>(null);
  const [damageFlash, setDamageFlash] = useState<boolean>(false);
  const [abilityStates, setAbilityStates] = useState<AbilitySlotState[]>([]);
  const [isBlinded, setIsBlinded] = useState<boolean>(false);
  const [isPointerLocked, setIsPointerLocked] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(60);
  const [matchWinner, setMatchWinner] = useState<TeamSide | null>(null);
  const [spectateState, setSpectateState] = useState<SpectateState | null>(null);
  const [crosshairBloomPx, setCrosshairBloomPx] = useState<number>(0);

  // Spike States
  const [spikeState, setSpikeState] = useState<'not_planted' | 'planted' | 'defused' | 'detonated'>('not_planted');
  const [spikeTimer, setSpikeTimer] = useState<number>(45);
  const [plantProgress, setPlantProgress] = useState<number>(0);
  const [defuseProgress, setDefuseProgress] = useState<number>(0);

  const [isMobile, setIsMobile] = useState<boolean>(() => isMobileDevice(settings.controlMode));

  useEffect(() => {
    setIsMobile(isMobileDevice(settings.controlMode));
  }, [settings.controlMode]);

  // Keep server agent in sync & listen for multiplayer room match launches
  useEffect(() => {
    multiplayerClient.connect();
    multiplayerClient.setAgent(selectedAgentId);
  }, [selectedAgentId]);

  const handleUpdateSettings = (newSettings: GameSettings) => {
    setSettings(newSettings);
    saveSettingsToStorage(newSettings);
    engineRef.current?.updateSettings(newSettings);
  };

  const handleUpdateProfile = (next: PlayerProfile) => {
    setProfile(next);
    saveProfile(next);
    if (next.favoriteAgentId !== selectedAgentId) {
      setSelectedAgentId(next.favoriteAgentId);
    }
  };

  const handleSelectMap = (nextMapId: string) => {
    setSelectedMapId(nextMapId);
    setActiveMap(nextMapId);
    saveSelectedMapId(nextMapId);
    if (engineRef.current) {
      if (appState === 'playing' || appState === 'paused') {
        engineRef.current.loadMap(nextMapId);
      } else {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    }
  };

  useEffect(() => {
    document.body.dataset.state = appState;
  }, [appState]);

  useEffect(() => {
    const blocked =
      appState !== 'playing' ||
      showBuyMenu ||
      showMapModal ||
      showScoreboard ||
      showSettings ||
      showLeaderboard ||
      isChatFocused;
    engineRef.current?.setUiBlocking(blocked);
  }, [appState, showBuyMenu, showMapModal, showScoreboard, showSettings, showLeaderboard, isChatFocused]);

  // Check ?autostart=1 on mount + clean up engine
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      const qMap = params.get('map') || undefined;
      const qMode = (params.get('mode') as MatchMode | null) || (qMap === 'TRAINING_GROUND' ? 'PRACTICE' : 'CUSTOM');
      const qTdm = params.get('tdm') === '1' ? 1 : params.get('tdm') === '2' ? 2 : undefined;
      if (qMap) {
        setSelectedMapId(qMap);
        setActiveMap(qMap);
      }
      if (qTdm) {
        setTdmTeamSize(qTdm);
      }
      startGame(qMode, null, [], true, qMap, qTdm);
    }
    return () => {
      if (hitmarkerTimeoutRef.current) clearTimeout(hitmarkerTimeoutRef.current);
      if (hitFeedbackTimeoutRef.current) clearTimeout(hitFeedbackTimeoutRef.current);
      if (damageFlashTimeoutRef.current) clearTimeout(damageFlashTimeoutRef.current);
      engineRef.current?.dispose();
      engineRef.current = null;
      voiceManager.leaveVoice();
    };
  }, []);

  // Listen for WebSocket MATCH_LAUNCH from server when Host starts a Custom Room match
  useEffect(() => {
    return multiplayerClient.subscribeMatchLaunch((launchedRoom) => {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
      startGame(launchedRoom.mode || 'CUSTOM', launchedRoom);
    });
  }, [settings, selectedAgentId, botDifficulty]);

  // Pause engine when tab is hidden in solo modes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && appState === 'playing' && !activeRoom) {
        setAppState('paused');
        engineRef.current?.setPaused(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [appState, activeRoom]);

  const triggerHitmarker = (isHeadshot: boolean) => {
    if (hitmarkerTimeoutRef.current) clearTimeout(hitmarkerTimeoutRef.current);
    setHitmarker({ active: true, isHeadshot });
    hitmarkerTimeoutRef.current = setTimeout(() => setHitmarker(null), 160);
  };

  const triggerHitFeedback = (fb: HitFeedback) => {
    if (hitFeedbackTimeoutRef.current) clearTimeout(hitFeedbackTimeoutRef.current);
    setHitFeedback(fb);
    hitFeedbackTimeoutRef.current = setTimeout(() => setHitFeedback(null), 950);
  };

  const triggerDamageFlash = () => {
    if (damageFlashTimeoutRef.current) clearTimeout(damageFlashTimeoutRef.current);
    setDamageFlash(true);
    damageFlashTimeoutRef.current = setTimeout(() => setDamageFlash(false), 200);
  };

  const buildPreMatchRoster = (
    mode: MatchMode,
    customRoom: CustomRoomState | null,
    allyBotAgentIds: string[],
    mapId: string,
    teamSizeOverride?: 1 | 2
  ): {
    mode: MatchMode;
    mapId: string;
    tdmTeamSize?: 1 | 2;
    playerTeam: TeamSide;
    defenders: PreMatchPlayer[];
    attackers: PreMatchPlayer[];
  } => {
    const mapDef = resolveMapDef(mapId);
    const isTdm = isTdmMap(mapDef);
    const isTraining = Boolean(mapDef.isTrainingMap || mode === 'PRACTICE');
    const maxSlots = isTdm
      ? clampTeamSizeForMap(mapDef, teamSizeOverride ?? customRoom?.tdmTeamSize ?? tdmTeamSize)
      : isTraining
        ? 1
        : 5;

    const myUsername = multiplayerClient.getCachedUsername();
    const myMember = customRoom?.members.find(
      (m) => m.username.toLowerCase() === myUsername.toLowerCase()
    );
    const playerTeam: TeamSide = myMember?.team ?? 'ATTACKERS';
    const oppTeam: TeamSide = playerTeam === 'ATTACKERS' ? 'DEFENDERS' : 'ATTACKERS';
    const agentKeys = Object.keys(AGENT_REGISTRY);
    const roster: PreMatchPlayer[] = [
      {
        id: 'player_0',
        name: multiplayerClient.usernameClaimed
          ? `@${multiplayerClient.username}`
          : profile.callsign || 'Operative',
        agentId: selectedAgentId,
        team: playerTeam,
        isLocalPlayer: true,
        isHuman: true,
      },
    ];

    const remoteMembers = (customRoom?.members ?? []).filter(
      (m) => m.username.toLowerCase() !== myUsername.toLowerCase()
    );
    for (const remote of remoteMembers) {
      roster.push({
        id: `remote_${remote.username}`,
        name: `@${remote.username}`,
        agentId: remote.agentId || 'KAEL',
        team: remote.team,
        isLocalPlayer: false,
        isHuman: true,
      });
    }

    const pushBot = (team: TeamSide, agentKey: string, idx: number, isAlly: boolean) => {
      const ag = AGENT_REGISTRY[agentKey] || AGENT_REGISTRY.KAEL;
      roster.push({
        id: `${isAlly ? 'ally' : 'opp'}_${idx + 1}`,
        name: `${isAlly ? 'Ally' : 'Foe'} ${ag.name}`,
        agentId: ag.id,
        team,
        isLocalPlayer: false,
        isHuman: false,
      });
    };

    if (customRoom) {
      if (customRoom.fillBots) {
        const allyCount = roster.filter((r) => r.team === playerTeam).length;
        const oppCount = roster.filter((r) => r.team === oppTeam).length;
        for (let i = 0; i < Math.max(0, maxSlots - allyCount); i++) {
          pushBot(playerTeam, agentKeys[(i + 1) % agentKeys.length], i, true);
        }
        for (let i = 0; i < Math.max(0, maxSlots - oppCount); i++) {
          pushBot(oppTeam, agentKeys[(i + 2) % agentKeys.length], i, false);
        }
      }
    } else if (!isTraining) {
      const maxAllyBots = Math.max(0, maxSlots - 1);
      if (allyBotAgentIds.length > 0 && mode !== 'CUSTOM') {
        allyBotAgentIds.slice(0, maxAllyBots).forEach((agId, i) => pushBot(playerTeam, agId, i, true));
      }
      if (mode !== 'CUSTOM') {
        for (let i = 0; i < maxSlots; i++) {
          pushBot(oppTeam, agentKeys[(i + 2) % agentKeys.length], i, false);
        }
      }
    }

    return {
      mode,
      mapId,
      tdmTeamSize: isTdm ? (maxSlots as 1 | 2) : undefined,
      playerTeam,
      defenders: roster.filter((p) => p.team === 'DEFENDERS'),
      attackers: roster.filter((p) => p.team === 'ATTACKERS'),
    };
  };

  const mountAndStartEngine = (
    mode: MatchMode,
    customRoom: CustomRoomState | null,
    allyBotAgentIds: string[],
    requestLock = false,
    mapId = selectedMapId,
    teamSizeOverride: 1 | 2 = tdmTeamSize
  ) => {
    const resolvedMap = resolveMapDef(mapId);
    const effectiveTdmSize = clampTeamSizeForMap(
      resolvedMap,
      teamSizeOverride ?? customRoom?.tdmTeamSize ?? tdmTeamSize
    ) as 1 | 2;
    setTdmKillTarget(getTdmKillTarget(effectiveTdmSize));
    setTrainingState(null);

    if (canvasMountRef.current) {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
      engineRef.current = new GameEngine(
        canvasMountRef.current,
        settings,
        selectedAgentId,
        customRoom?.botDifficulty ?? botDifficulty,
        {
          onStatsUpdate: (stats) => setPlayerStats(stats),
          onRoundPhaseChange: (phase, time) => {
            setRoundPhase(phase);
            setRoundTimeRemaining(time);
            if (phase !== 'BUY_PHASE' && mode !== 'PRACTICE' && !resolvedMap.isTrainingMap) {
              setShowBuyMenu(false);
            }
          },
          onRoundScoreChange: (attWins, defWins, round) => {
            setAttackerRoundsWon(attWins);
            setDefenderRoundsWon(defWins);
            setCurrentRound(round);
          },
          onTdmScoreUpdate: (attKills, defKills, targetKills) => {
            setAttackerRoundsWon(attKills);
            setDefenderRoundsWon(defKills);
            setTdmKillTarget(targetKills);
          },
          onTrainingUpdate: (nextTraining) => {
            setTrainingState(nextTraining);
          },
          onKillEvent: (event) => {
            setKillFeed((prev) => [...prev.slice(-6), event]);
          },
          onPlayerHealthUpdate: (currentHp, currentArmor) => {
            setHp(currentHp);
            setArmor(currentArmor);
          },
          onPlayerDamage: () => {
            triggerDamageFlash();
          },
          onWeaponUpdate: (weaponDef, inMag, reserve, reloading, slot) => {
            setCurrentWeapon(weaponDef);
            setAmmoInMag(inMag);
            setReserveAmmo(reserve);
            setIsReloading(reloading);
            if (slot) setActiveSlot(slot);
          },
          onSpikeStateUpdate: (state, timer, plantP, defuseP) => {
            setSpikeState(state);
            setSpikeTimer(timer);
            setPlantProgress(plantP);
            setDefuseProgress(defuseP);
          },
          onHitmarker: (isHeadshot) => {
            triggerHitmarker(isHeadshot);
          },
          onHitFeedback: (fb) => {
            triggerHitFeedback(fb);
          },
          onAbilityStateUpdate: (states) => {
            setAbilityStates(states);
          },
          onBlindStateChange: (blinded) => {
            setIsBlinded(blinded);
          },
          onPointerLockChange: (locked) => {
            setIsPointerLocked(locked);
          },
          onFpsUpdate: (currentFps) => setFps(currentFps),
          onSpectateUpdate: (nextSpectate) => setSpectateState(nextSpectate),
          onCrosshairBloomUpdate: (bloomPx) => setCrosshairBloomPx(bloomPx),
          onMatchOver: (winner, summary) => {
            setMatchWinner(winner);
            setAppState('gameover');
            setLastMatchSummary(summary);
            setProfile((prev) => {
              const updated = recordMatchToProfile(prev, summary);
              if (auth.currentUser) {
                saveMatchSummaryToFirestore(auth.currentUser, summary, updated, mapId).catch((err) => {
                  console.warn('[Firestore] Failed to persist match to cloud:', err);
                });
              }
              return updated;
            });
            multiplayerClient.notifyMatchEnded();
          },
        },
        mode,
        customRoom,
        allyBotAgentIds,
        mapId,
        effectiveTdmSize
      );

      if (engineRef.current.isTrainingMatch) {
        setTrainingState(engineRef.current.getTrainingState());
      }
    }

    setPrematchRoster(null);
    setAppState('playing');
    engineRef.current?.setPaused(false);
    if (requestLock && !isMobile) {
      engineRef.current?.input.requestPointerLock();
    }
  };

  const startGame = (
    mode: MatchMode = lastMatchMode,
    customRoom: CustomRoomState | null = null,
    allyBotAgentIds: string[] = lastAllyBotIds,
    skipPrematch = false,
    overrideMapId?: string,
    overrideTdmTeamSize?: 1 | 2
  ) => {
    soundEngine.init();
    const effectiveMapId = customRoom?.mapId || overrideMapId || selectedMapId;
    const effectiveMap = resolveMapDef(effectiveMapId);
    const effectiveTdmSize = clampTeamSizeForMap(
      effectiveMap,
      overrideTdmTeamSize ?? customRoom?.tdmTeamSize ?? tdmTeamSize
    ) as 1 | 2;
    const safeMode: MatchMode =
      isTdmMap(effectiveMap) && mode === 'COMPETITIVE' ? 'SKIRMISH' : mode;

    setActiveMap(effectiveMapId);
    setLastMatchMode(safeMode);
    setLastAllyBotIds(allyBotAgentIds);
    setActiveRoom(customRoom);
    setTdmKillTarget(getTdmKillTarget(effectiveTdmSize));
    setShowBuyMenu(false);
    setShowMapModal(false);
    setShowScoreboard(false);
    setShowSettings(false);
    setIsChatFocused(false);
    setIsBlinded(false);
    setDamageFlash(false);
    setSpectateState(null);
    pendingLaunchRef.current = {
      mode: safeMode,
      customRoom,
      allyBotAgentIds,
      mapId: effectiveMapId,
      tdmTeamSize: effectiveTdmSize,
    };

    if (skipPrematch) {
      mountAndStartEngine(safeMode, customRoom, allyBotAgentIds, false, effectiveMapId, effectiveTdmSize);
    } else {
      setPrematchRoster(buildPreMatchRoster(safeMode, customRoom, allyBotAgentIds, effectiveMapId, effectiveTdmSize));
      setAppState('prematch');
    }
  };

  const handleFinishPreMatch = (fromUserClick = false) => {
    if (appState !== 'prematch') return;
    const pending = pendingLaunchRef.current ?? {
      mode: lastMatchMode,
      customRoom: activeRoom,
      allyBotAgentIds: lastAllyBotIds,
      mapId: selectedMapId,
      tdmTeamSize,
    };
    pendingLaunchRef.current = null;
    mountAndStartEngine(
      pending.mode,
      pending.customRoom,
      pending.allyBotAgentIds,
      fromUserClick,
      pending.mapId,
      pending.tdmTeamSize
    );
  };

  // Keyboard shortcut listener honoring custom KeyBindings
  useEffect(() => {
    const kb = settings.keyBindings;
    const isTypingTarget = () => {
      if (isChatFocused) return true;
      const activeEl = document.activeElement;
      if (!activeEl) return false;
      const tag = activeEl.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (appState !== 'playing' || document.body.dataset.rebinding === '1') return;
      if (isTypingTarget()) return;

      if (e.code === kb.buyMenu) {
        setShowBuyMenu((prev) => !prev);
      } else if (e.code === kb.tacticalMap) {
        setShowMapModal((prev) => !prev);
      } else if (e.code === kb.scoreboard) {
        e.preventDefault();
        setShowScoreboard(true);
      } else if (e.code === 'Escape' || e.code === kb.pause) {
        if (showBuyMenu) {
          setShowBuyMenu(false);
        } else if (showMapModal) {
          setShowMapModal(false);
        } else if (showScoreboard) {
          setShowScoreboard(false);
        } else if (showSettings) {
          setShowSettings(false);
        } else {
          setAppState('paused');
          engineRef.current?.setPaused(true);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isTypingTarget()) return;
      if (e.code === kb.scoreboard) {
        setShowScoreboard(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [appState, showBuyMenu, showMapModal, showScoreboard, showSettings, isChatFocused, settings.keyBindings]);

  const handleOpenInGameSettings = () => {
    setShowSettings(true);
    engineRef.current?.setPaused(true);
  };

  const handleCloseSettings = () => {
    setShowSettings(false);
    if (appState === 'playing') {
      engineRef.current?.setPaused(false);
    }
  };

  const handleResumeGame = () => {
    setAppState('playing');
    engineRef.current?.setPaused(false);
    engineRef.current?.input.requestPointerLock();
  };

  const handleReturnToTitle = () => {
    engineRef.current?.dispose();
    engineRef.current = null;
    multiplayerClient.notifyMatchEnded();
    setActiveRoom(null);
    setAppState('title');
    setAttackerRoundsWon(0);
    setDefenderRoundsWon(0);
    setCurrentRound(1);
    setKillFeed([]);
    setMatchWinner(null);
    setShowBuyMenu(false);
    setShowMapModal(false);
    setShowScoreboard(false);
    setShowSettings(false);
    setIsChatFocused(false);
    setIsBlinded(false);
    setDamageFlash(false);
    setSpectateState(null);
    if (!multiplayerClient.currentRoom) {
      voiceManager.leaveVoice();
    }
  };

  const handlePlayAgain = () => {
    engineRef.current?.dispose();
    engineRef.current = null;
    setAttackerRoundsWon(0);
    setDefenderRoundsWon(0);
    setCurrentRound(1);
    setKillFeed([]);
    setMatchWinner(null);
    setSpectateState(null);
    startGame(lastMatchMode, activeRoom);
  };

  const handleBuyWeapon = (weaponId: string) => {
    engineRef.current?.buyItem(weaponId);
  };

  const handleBuyShield = (shieldId: 'LIGHT_SHIELD' | 'HEAVY_SHIELD') => {
    engineRef.current?.buyItem(shieldId);
  };

  const handleOrientationChange = (portrait: boolean) => {
    if (portrait && appState === 'playing') {
      setAppState('paused');
      engineRef.current?.setPaused(true);
    }
  };

  const currentAgent = AGENT_REGISTRY[selectedAgentId] || AGENT_REGISTRY.KAEL;
  const playerCredits = playerStats[0]?.credits ?? 800;
  const hasPrimaryWeapon = Boolean(engineRef.current?.playerCombatant?.primaryWeapon);

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-[#0F1923] text-[#ECE8E1]">
      <OrientationGuard onOrientationChange={handleOrientationChange} />

      {/* Valorant-Inspired Fullscreen Preload Splash */}
      {isBootLoading && <LoadingSplash onComplete={() => setIsBootLoading(false)} />}

      {/* 3D WebGL Canvas Mount Container */}
      <div ref={canvasMountRef} data-testid="three-canvas" className="absolute inset-0 h-full w-full" />

      {/* Screen 1: Hollow Strike Main Lobby */}
      {appState === 'title' && (
        <div className="absolute inset-0 z-30">
          <LobbyScreen
            selectedAgentId={selectedAgentId}
            onSelectAgent={setSelectedAgentId}
            selectedMapId={selectedMapId}
            onSelectMap={handleSelectMap}
            tdmTeamSize={tdmTeamSize}
            onSelectTdmTeamSize={setTdmTeamSize}
            difficulty={botDifficulty}
            onSelectDifficulty={(diff) => {
              setBotDifficulty(diff);
              engineRef.current?.botControllers.forEach((c) => c.setDifficulty(diff));
            }}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            profile={profile}
            currentUser={currentUser}
            onUpdateProfile={handleUpdateProfile}
            onResetProfile={() => setProfile(resetProfileData())}
            onStartGame={startGame}
            onOpenLeaderboard={() => setShowLeaderboard(true)}
            onUserAuthChange={(u) => setCurrentUser(u)}
          />
        </div>
      )}

      {/* Screen 1.5: Pre-Match Versus Loading Screen */}
      {appState === 'prematch' && prematchRoster && (
        <PreMatchScreen
          mode={prematchRoster.mode}
          mapId={prematchRoster.mapId}
          tdmTeamSize={prematchRoster.tdmTeamSize}
          playerTeam={prematchRoster.playerTeam}
          defenders={prematchRoster.defenders}
          attackers={prematchRoster.attackers}
          onDeployNow={() => handleFinishPreMatch(true)}
        />
      )}

      {/* Screen 2: Active Gameplay HUD */}
      {appState === 'playing' && engineRef.current && (
        <>
          <GameHUD
            playerCombatant={engineRef.current.playerCombatant}
            allCombatants={engineRef.current.combatants}
            allStats={playerStats}
            agent={currentAgent}
            abilityStates={abilityStates}
            weapon={currentWeapon}
            ammoInMag={ammoInMag}
            reserveAmmo={reserveAmmo}
            isReloading={isReloading}
            activeSlot={activeSlot}
            hasPrimaryWeapon={hasPrimaryWeapon}
            hp={hp}
            armor={armor}
            credits={playerCredits}
            roundPhase={roundPhase}
            roundTimeRemaining={roundTimeRemaining}
            attackerRoundsWon={attackerRoundsWon}
            defenderRoundsWon={defenderRoundsWon}
            currentRound={currentRound}
            spikeState={spikeState}
            spikePosition={engineRef.current.spikePosition}
            spikeTimer={spikeTimer}
            plantProgress={plantProgress}
            defuseProgress={defuseProgress}
            killFeed={killFeed}
            hitmarker={hitmarker}
            hitFeedback={hitFeedback}
            damageFlash={damageFlash}
            crosshairColor={settings.crosshairColor}
            crosshairSize={settings.crosshairSize}
            crosshairConfig={settings.crosshairConfig}
            crosshairBloomPx={crosshairBloomPx}
            isBlinded={isBlinded}
            isPointerLocked={isPointerLocked}
            isMobile={isMobile}
            revealedEnemyIds={engineRef.current.abilityMgr.revealedEnemyIds}
            fps={fps}
            showFps={settings.showFps}
            isTdmMatch={engineRef.current.isTdmMatch}
            tdmKillTarget={engineRef.current.tdmKillTarget}
            isTrainingMatch={engineRef.current.isTrainingMatch}
            teamSize={engineRef.current.tdmTeamSize}
            spectateState={spectateState}
            onTriggerAbility={(slot) => engineRef.current?.input.triggerMobileAbility(slot)}
            onSwitchWeapon={(slot) => engineRef.current?.switchWeaponSlot(slot)}
            onSkipBuyPhase={() => engineRef.current?.skipBuyPhase()}
            onOpenBuyMenu={() => setShowBuyMenu(true)}
            onOpenMap={() => setShowMapModal(true)}
            onOpenScoreboard={() => setShowScoreboard(true)}
            onOpenSettings={handleOpenInGameSettings}
            onOpenPause={() => {
              setAppState('paused');
              engineRef.current?.setPaused(true);
            }}
            onSpectatePrev={() => engineRef.current?.cycleSpectateTarget(-1)}
            onSpectateNext={() => engineRef.current?.cycleSpectateTarget(1)}
            onToggleSpectateMode={() => engineRef.current?.toggleSpectateMode()}
            onChatFocusChange={setIsChatFocused}
          />

          {/* The Range Training Console HUD */}
          {engineRef.current.isTrainingMatch && trainingState && (
            <TrainingHUD
              trainingState={trainingState}
              isMobile={isMobile}
              onSelectDrill={(drill) => engineRef.current?.setTrainingDrill(drill)}
              onWarpZone={(zone) => engineRef.current?.warpToTrainingZone(zone)}
              onUpdateConfig={(patch) => engineRef.current?.setTrainingConfig(patch)}
              onResetStats={() => engineRef.current?.resetTrainingStats()}
            />
          )}

          {/* Mobile Virtual Controls */}
          {isMobile && (
            <MobileControls
              input={engineRef.current.input}
              agent={currentAgent}
              abilityStates={abilityStates}
              settings={settings}
              roundPhase={roundPhase}
              hasPrimaryWeapon={hasPrimaryWeapon}
              activeSlot={activeSlot}
              onSwitchWeapon={(slot) => engineRef.current?.switchWeaponSlot(slot)}
              onSkipBuyPhase={() => engineRef.current?.skipBuyPhase()}
              onOpenBuyMenu={() => setShowBuyMenu(true)}
              onOpenMap={() => setShowMapModal(true)}
              onOpenSettings={handleOpenInGameSettings}
              onOpenScoreboard={() => setShowScoreboard(true)}
              onOpenPause={() => {
                setAppState('paused');
                engineRef.current?.setPaused(true);
              }}
              hideSpike={engineRef.current.isTdmMatch}
              isSpectating={Boolean(spectateState?.active)}
              canPlantOrDefuse={
                (engineRef.current.playerCombatant.team === 'ATTACKERS' &&
                  engineRef.current.playerCombatant.hasSpike &&
                  spikeState === 'not_planted') ||
                (engineRef.current.playerCombatant.team === 'DEFENDERS' && spikeState === 'planted')
              }
              isPlantingOrDefusing={plantProgress > 0 || defuseProgress > 0}
            />
          )}
        </>
      )}

      {/* Buy Menu Overlay */}
      {showBuyMenu && (
        <BuyMenu
          credits={playerCredits}
          currentWeaponId={currentWeapon.id}
          currentArmor={armor}
          agent={currentAgent}
          isFreeMode={Boolean(engineRef.current?.isTrainingMatch || lastMatchMode === 'PRACTICE')}
          isTdmMode={Boolean(engineRef.current?.isTdmMatch)}
          canBuy={
            roundPhase === 'BUY_PHASE' ||
            lastMatchMode === 'PRACTICE' ||
            Boolean(engineRef.current?.isTrainingMatch) ||
            Boolean(engineRef.current?.isTdmMatch)
          }
          onBuyWeapon={handleBuyWeapon}
          onBuyShield={handleBuyShield}
          onClose={() => setShowBuyMenu(false)}
        />
      )}

      {/* Tactical Map Modal */}
      {showMapModal && engineRef.current && (
        <TacticalMapModal
          playerCombatant={engineRef.current.playerCombatant}
          allCombatants={engineRef.current.combatants}
          spikePosition={engineRef.current.spikePosition}
          spikeState={spikeState}
          playerTeam={engineRef.current.playerTeam}
          revealedEnemyIds={engineRef.current.abilityMgr.revealedEnemyIds}
          onClose={() => setShowMapModal(false)}
        />
      )}

      {/* Scoreboard Modal */}
      {showScoreboard && (
        <ScoreboardModal
          stats={playerStats}
          attackerRoundsWon={attackerRoundsWon}
          defenderRoundsWon={defenderRoundsWon}
          isTdmMatch={Boolean(engineRef.current?.isTdmMatch)}
          tdmKillTarget={tdmKillTarget}
          onClose={() => setShowScoreboard(false)}
        />
      )}

      {/* Pause Modal */}
      {appState === 'paused' && (
        <PauseModal
          attackerScore={attackerRoundsWon}
          defenderScore={defenderRoundsWon}
          currentRound={currentRound}
          isTdmMatch={Boolean(engineRef.current?.isTdmMatch)}
          teamSize={engineRef.current?.tdmTeamSize}
          onResume={handleResumeGame}
          onOpenSettings={() => setShowSettings(true)}
          onReturnToTitle={handleReturnToTitle}
        />
      )}

      {/* Tactical Settings Modal */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onClose={handleCloseSettings}
        />
      )}

      {/* Match Conclusion Modal */}
      {appState === 'gameover' && matchWinner && (
        <MatchEndModal
          winner={matchWinner}
          playerTeam={engineRef.current?.playerTeam || 'ATTACKERS'}
          attackerRounds={attackerRoundsWon}
          defenderRounds={defenderRoundsWon}
          stats={playerStats}
          isTdmMatch={Boolean(engineRef.current?.isTdmMatch)}
          currentUser={currentUser}
          onPlayAgain={handlePlayAgain}
          onReturnToTitle={handleReturnToTitle}
          onOpenLeaderboard={() => setShowLeaderboard(true)}
        />
      )}

      {/* Global Cloud Leaderboard Modal */}
      {showLeaderboard && (
        <GlobalLeaderboardModal
          currentUser={currentUser}
          profile={profile}
          onClose={() => setShowLeaderboard(false)}
          onUserAuthChange={(u) => setCurrentUser(u)}
        />
      )}
    </div>
  );
}
