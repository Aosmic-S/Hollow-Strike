/**
 * Hollow Strike - Main Application Entry
 * Full-viewport tactical Game Shell with Three.js engine lifecycle,
 * mobile landscape lock, cross-platform controls, and live combat feedback.
 */

import React, { useEffect, useRef, useState } from 'react';
import { GameEngine, isSoftwareGl } from './game/gameEngine';
import { isMobileDevice } from './game/device';
import { soundEngine } from './game/audio';
import {
  loadProfile,
  loadSavedSettings,
  recordMatchToProfile,
  resetProfileData,
  saveProfile,
  saveSettingsToStorage,
} from './game/profileStore';
import {
  AbilitySlotState,
  AGENT_REGISTRY,
  BotDifficulty,
  GameSettings,
  HitFeedback,
  KillEvent,
  MatchMode,
  PlayerProfile,
  PlayerStats,
  RoundPhase,
  TeamSide,
  WEAPON_REGISTRY,
  WeaponDef,
} from './game/types';
import { LobbyScreen } from './components/LobbyScreen';
import { GameHUD } from './components/GameHUD';
import { MobileControls } from './components/MobileControls';
import { BuyMenu } from './components/BuyMenu';
import { ScoreboardModal } from './components/ScoreboardModal';
import { SettingsModal } from './components/SettingsModal';
import { MatchEndModal } from './components/MatchEndModal';
import { PauseModal } from './components/PauseModal';
import { OrientationGuard } from './components/OrientationGuard';
import { TacticalMapModal } from './components/TacticalMapModal';

type AppState = 'title' | 'playing' | 'paused' | 'gameover';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const hitmarkerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hitFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const damageFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persistent Player Profile & Settings
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile());
  const [settings, setSettings] = useState<GameSettings>(() => {
    const mobile = isMobileDevice('AUTO');
    return loadSavedSettings({
      graphics: mobile || isSoftwareGl ? 'LOW' : 'HIGH',
      fpsCap: 60,
      showFps: false,
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
    });
  });

  // App Shell State
  const [appState, setAppState] = useState<AppState>('title');
  const [selectedAgentId, setSelectedAgentId] = useState<string>(() => profile.favoriteAgentId || 'ZEPHYR');
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('MEDIUM');
  const [lastMatchMode, setLastMatchMode] = useState<MatchMode>('COMPETITIVE');

  // Modals
  const [showBuyMenu, setShowBuyMenu] = useState<boolean>(false);
  const [showMapModal, setShowMapModal] = useState<boolean>(false);
  const [showScoreboard, setShowScoreboard] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Live HUD States
  const [hp, setHp] = useState<number>(100);
  const [armor, setArmor] = useState<number>(0);
  const [currentWeapon, setCurrentWeapon] = useState<WeaponDef>(WEAPON_REGISTRY.APEX_9);
  const [ammoInMag, setAmmoInMag] = useState<number>(12);
  const [reserveAmmo, setReserveAmmo] = useState<number>(36);
  const [isReloading, setIsReloading] = useState<boolean>(false);
  const [activeSlot, setActiveSlot] = useState<1 | 2>(2);
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

  // Spike States
  const [spikeState, setSpikeState] = useState<'not_planted' | 'planted' | 'defused' | 'detonated'>('not_planted');
  const [spikeTimer, setSpikeTimer] = useState<number>(45);
  const [plantProgress, setPlantProgress] = useState<number>(0);
  const [defuseProgress, setDefuseProgress] = useState<number>(0);

  const [isMobile, setIsMobile] = useState<boolean>(() => isMobileDevice(settings.controlMode));

  // Sync device mode whenever controlMode changes
  useEffect(() => {
    setIsMobile(isMobileDevice(settings.controlMode));
  }, [settings.controlMode]);

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

  // Mirror app state to document.body.dataset.state
  useEffect(() => {
    document.body.dataset.state = appState;
  }, [appState]);

  // Sync UI modal blocking with InputManager
  useEffect(() => {
    const blocked = appState !== 'playing' || showBuyMenu || showMapModal || showScoreboard || showSettings;
    engineRef.current?.setUiBlocking(blocked);
  }, [appState, showBuyMenu, showMapModal, showScoreboard, showSettings]);

  // Check ?autostart=1 on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      startGame('COMPETITIVE');
    }
    return () => {
      if (hitmarkerTimeoutRef.current) clearTimeout(hitmarkerTimeoutRef.current);
      if (hitFeedbackTimeoutRef.current) clearTimeout(hitFeedbackTimeoutRef.current);
      if (damageFlashTimeoutRef.current) clearTimeout(damageFlashTimeoutRef.current);
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  // Pause engine when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && appState === 'playing') {
        setAppState('paused');
        engineRef.current?.setPaused(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [appState]);

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

  const startGame = (mode: MatchMode = lastMatchMode) => {
    soundEngine.init();
    setLastMatchMode(mode);
    setAppState('playing');
    setShowBuyMenu(false);
    setShowMapModal(false);
    setShowScoreboard(false);
    setShowSettings(false);
    setIsBlinded(false);
    setDamageFlash(false);

    if (canvasMountRef.current && !engineRef.current) {
      engineRef.current = new GameEngine(
        canvasMountRef.current,
        settings,
        selectedAgentId,
        botDifficulty,
        {
          onStatsUpdate: (stats) => setPlayerStats(stats),
          onRoundPhaseChange: (phase, time) => {
            setRoundPhase(phase);
            setRoundTimeRemaining(time);
            if (phase !== 'BUY_PHASE' && mode !== 'PRACTICE') {
              setShowBuyMenu(false);
            }
          },
          onRoundScoreChange: (attWins, defWins, round) => {
            setAttackerRoundsWon(attWins);
            setDefenderRoundsWon(defWins);
            setCurrentRound(round);
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
          onMatchOver: (winner, summary) => {
            setMatchWinner(winner);
            setAppState('gameover');
            setProfile((prev) => recordMatchToProfile(prev, summary));
          },
        },
        mode
      );
    }
  };

  // Keyboard shortcut listener for B (Buy Menu), M (Map), Tab (Scoreboard), Esc/P (Pause)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (appState !== 'playing') return;

      if (e.code === 'KeyB') {
        setShowBuyMenu((prev) => !prev);
      } else if (e.code === 'KeyM') {
        setShowMapModal((prev) => !prev);
      } else if (e.code === 'Tab') {
        e.preventDefault();
        setShowScoreboard(true);
      } else if (e.code === 'Escape' || e.code === 'KeyP') {
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
      if (e.code === 'Tab') {
        setShowScoreboard(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [appState, showBuyMenu, showMapModal, showScoreboard, showSettings]);

  const handleResumeGame = () => {
    setAppState('playing');
    engineRef.current?.setPaused(false);
    engineRef.current?.input.requestPointerLock();
  };

  const handleReturnToTitle = () => {
    engineRef.current?.dispose();
    engineRef.current = null;
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
    setIsBlinded(false);
    setDamageFlash(false);
  };

  const handlePlayAgain = () => {
    engineRef.current?.dispose();
    engineRef.current = null;
    setAttackerRoundsWon(0);
    setDefenderRoundsWon(0);
    setCurrentRound(1);
    setKillFeed([]);
    setMatchWinner(null);
    startGame(lastMatchMode);
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

  const currentAgent = AGENT_REGISTRY[selectedAgentId] || AGENT_REGISTRY.ZEPHYR;
  const playerCredits = playerStats[0]?.credits ?? 800;
  const hasPrimaryWeapon = Boolean(engineRef.current?.playerCombatant?.primaryWeapon);

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-[#070b14] text-white">
      <OrientationGuard onOrientationChange={handleOrientationChange} />

      {/* 3D WebGL Canvas Mount Container */}
      <div ref={canvasMountRef} data-testid="three-canvas" className="absolute inset-0 h-full w-full" />

      {/* Screen 1: Hollow Strike Main Lobby */}
      {appState === 'title' && (
        <div className="absolute inset-0 z-30">
          <LobbyScreen
            selectedAgentId={selectedAgentId}
            onSelectAgent={setSelectedAgentId}
            difficulty={botDifficulty}
            onSelectDifficulty={(diff) => {
              setBotDifficulty(diff);
              engineRef.current?.botControllers.forEach((c) => c.setDifficulty(diff));
            }}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            onResetProfile={() => setProfile(resetProfileData())}
            onStartGame={startGame}
          />
        </div>
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
            isBlinded={isBlinded}
            isPointerLocked={isPointerLocked}
            isMobile={isMobile}
            revealedEnemyIds={engineRef.current.abilityMgr.revealedEnemyIds}
            fps={fps}
            showFps={settings.showFps}
            onTriggerAbility={(slot) => engineRef.current?.input.triggerMobileAbility(slot)}
            onSwitchWeapon={(slot) => engineRef.current?.switchWeaponSlot(slot)}
            onSkipBuyPhase={() => engineRef.current?.skipBuyPhase()}
            onOpenBuyMenu={() => setShowBuyMenu(true)}
            onOpenMap={() => setShowMapModal(true)}
            onOpenScoreboard={() => setShowScoreboard(true)}
            onOpenPause={() => {
              setAppState('paused');
              engineRef.current?.setPaused(true);
            }}
          />

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
          canBuy={roundPhase === 'BUY_PHASE' || lastMatchMode === 'PRACTICE'}
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
          onClose={() => setShowScoreboard(false)}
        />
      )}

      {/* Pause Modal */}
      {appState === 'paused' && (
        <PauseModal
          attackerScore={attackerRoundsWon}
          defenderScore={defenderRoundsWon}
          currentRound={currentRound}
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
          onClose={() => setShowSettings(false)}
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
          onPlayAgain={handlePlayAgain}
          onReturnToTitle={handleReturnToTitle}
        />
      )}
    </div>
  );
}
