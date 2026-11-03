/**
 * Hollow Strike - Main Application Entry
 * Full-viewport tactical Game Shell with Three.js engine lifecycle,
 * mobile landscape lock, and cross-platform controls.
 */

import React, { useEffect, useRef, useState } from 'react';
import { GameEngine, isSoftwareGl } from './game/gameEngine';
import {
  GameSettings,
  BotDifficulty,
  PlayerStats,
  RoundPhase,
  TeamSide,
  WeaponDef,
  KillEvent,
  WEAPON_REGISTRY,
  AGENT_REGISTRY,
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
import { isTouchDevice } from './utils/device';

type AppState = 'title' | 'playing' | 'paused' | 'gameover';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // App Shell State
  const [appState, setAppState] = useState<AppState>('title');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('ZEPHYR');
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('MEDIUM');

  // Modals
  const [showBuyMenu, setShowBuyMenu] = useState<boolean>(false);
  const [showScoreboard, setShowScoreboard] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Live HUD States
  const [hp, setHp] = useState<number>(100);
  const [armor, setArmor] = useState<number>(0);
  const [currentWeapon, setCurrentWeapon] = useState<WeaponDef>(WEAPON_REGISTRY.APEX_9);
  const [ammoInMag, setAmmoInMag] = useState<number>(12);
  const [reserveAmmo, setReserveAmmo] = useState<number>(36);
  const [isReloading, setIsReloading] = useState<boolean>(false);
  const [roundPhase, setRoundPhase] = useState<RoundPhase>('BUY_PHASE');
  const [roundTimeRemaining, setRoundTimeRemaining] = useState<number>(20);
  const [attackerRoundsWon, setAttackerRoundsWon] = useState<number>(0);
  const [defenderRoundsWon, setDefenderRoundsWon] = useState<number>(0);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [killFeed, setKillFeed] = useState<KillEvent[]>([]);
  const [hitmarker, setHitmarker] = useState<{ active: boolean; isHeadshot: boolean } | null>(null);
  const hitmarkerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fps, setFps] = useState<number>(60);
  const [matchWinner, setMatchWinner] = useState<TeamSide | null>(null);

  // Spike States
  const [spikeState, setSpikeState] = useState<'not_planted' | 'planted' | 'defused' | 'detonated'>('not_planted');
  const [spikeTimer, setSpikeTimer] = useState<number>(45);
  const [plantProgress, setPlantProgress] = useState<number>(0);
  const [defuseProgress, setDefuseProgress] = useState<number>(0);

  // Device & Settings
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [settings, setSettings] = useState<GameSettings>(() => {
    const isTouch = isTouchDevice();
    return {
      graphics: isTouch || isSoftwareGl ? 'LOW' : 'HIGH',
      fpsCap: 60,
      showFps: false,
      mouseSensitivity: 0.0022,
      touchSensitivity: 0.0035,
      fov: 90,
      volume: 0.7,
      soundEnabled: true,
      autoFireMobile: false,
      aimAssistMobile: true,
      touchScale: 1.0,
    };
  });

  // Mirror app state to document.body.dataset.state for ultra mode
  useEffect(() => {
    document.body.dataset.state = appState;
  }, [appState]);

  // Clear hitmarker timeout on component unmount
  useEffect(() => {
    return () => {
      if (hitmarkerTimeoutRef.current) {
        clearTimeout(hitmarkerTimeoutRef.current);
      }
    };
  }, []);

  // Auto-pause tracking: whether pause was triggered automatically due to portrait or tab hidden
  const autoPausedRef = useRef<boolean>(false);

  // Check ?autostart=1 on mount & detect mobile
  useEffect(() => {
    const isTouch = isTouchDevice();
    setIsMobile(isTouch);

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      startGame();
    }
  }, []);

  // Pause engine when device is in portrait or tab is hidden (visibilitychange), resume on landscape
  useEffect(() => {
    const handleVisibilityOrOrientationChange = () => {
      const isTouch = isTouchDevice();
      const isPortrait = isTouch && window.innerHeight > window.innerWidth;
      const isHidden = document.visibilityState === 'hidden';

      if (isPortrait || isHidden) {
        if (appState === 'playing') {
          autoPausedRef.current = true;
          setAppState('paused');
          engineRef.current?.setPaused(true);
        }
      } else {
        // Returned to landscape and tab is visible
        if (appState === 'paused' && autoPausedRef.current) {
          autoPausedRef.current = false;
          setAppState('playing');
          engineRef.current?.setPaused(false);
          if (!isTouch) {
            engineRef.current?.input.requestPointerLock();
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrOrientationChange);
    window.addEventListener('resize', handleVisibilityOrOrientationChange);
    window.addEventListener('orientationchange', handleVisibilityOrOrientationChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrOrientationChange);
      window.removeEventListener('resize', handleVisibilityOrOrientationChange);
      window.removeEventListener('orientationchange', handleVisibilityOrOrientationChange);
    };
  }, [appState]);

  const startGame = () => {
    setAppState('playing');

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
            if (phase === 'BUY_PHASE') {
              // Optionally show buy menu reminder
            } else {
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
          onWeaponUpdate: (weaponDef, inMag, reserve, reloading) => {
            setCurrentWeapon(weaponDef);
            setAmmoInMag(inMag);
            setReserveAmmo(reserve);
            setIsReloading(reloading);
          },
          onSpikeStateUpdate: (state, timer, plantP, defuseP) => {
            setSpikeState(state);
            setSpikeTimer(timer);
            setPlantProgress(plantP);
            setDefuseProgress(defuseP);
          },
          onHitmarker: (isHeadshot) => {
            setHitmarker({ active: true, isHeadshot });
            if (hitmarkerTimeoutRef.current) clearTimeout(hitmarkerTimeoutRef.current);
            hitmarkerTimeoutRef.current = setTimeout(() => {
              setHitmarker(null);
              hitmarkerTimeoutRef.current = null;
            }, 140);
          },
          onFpsUpdate: (currentFps) => setFps(currentFps),
          onMatchOver: (winner) => {
            setMatchWinner(winner);
            setAppState('gameover');
          },
        }
      );

      // Pause the game when pointer lock is lost during play
      engineRef.current.input.onPointerLockLoss = () => {
        setAppState((prevState) => {
          if (prevState === 'playing') {
            engineRef.current?.setPaused(true);
            return 'paused';
          }
          return prevState;
        });
      };
    }
  };

  // Keyboard shortcut listener for B (Buy Menu), Tab (Scoreboard), Esc (Pause)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (appState !== 'playing') return;

      if (e.code === 'KeyB') {
        if (roundPhase === 'BUY_PHASE') {
          setShowBuyMenu((prev) => !prev);
        }
      } else if (e.code === 'Tab') {
        e.preventDefault();
        setShowScoreboard(true);
      } else if (e.code === 'Escape' || e.code === 'KeyP') {
        if (showBuyMenu) {
          setShowBuyMenu(false);
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
  }, [appState, roundPhase, showBuyMenu, showScoreboard, showSettings]);

  const handleResumeGame = () => {
    setAppState('playing');
    engineRef.current?.setPaused(false);
    engineRef.current?.input.requestPointerLock();
  };

  const handleReturnToTitle = () => {
    if (hitmarkerTimeoutRef.current) {
      clearTimeout(hitmarkerTimeoutRef.current);
      hitmarkerTimeoutRef.current = null;
    }
    setHitmarker(null);
    engineRef.current?.dispose();
    engineRef.current = null;
    setAppState('title');
    setShowBuyMenu(false);
    setShowScoreboard(false);
    setShowSettings(false);
  };

  const handlePlayAgain = () => {
    if (hitmarkerTimeoutRef.current) {
      clearTimeout(hitmarkerTimeoutRef.current);
      hitmarkerTimeoutRef.current = null;
    }
    setHitmarker(null);
    engineRef.current?.dispose();
    engineRef.current = null;
    setAttackerRoundsWon(0);
    setDefenderRoundsWon(0);
    setCurrentRound(1);
    setKillFeed([]);
    setMatchWinner(null);
    startGame();
  };

  const handleBuyWeapon = (weaponId: string) => {
    engineRef.current?.buyItem(weaponId);
  };

  const handleBuyShield = (shieldId: 'LIGHT_SHIELD' | 'HEAVY_SHIELD') => {
    engineRef.current?.buyItem(shieldId);
  };

  const currentAgent = AGENT_REGISTRY[selectedAgentId] || AGENT_REGISTRY.ZEPHYR;
  const playerCredits = playerStats[0]?.credits || 800;

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-[#070b14] text-white">
      {/* Mobile Orientation Guard */}
      <OrientationGuard />

      {/* 3D WebGL Canvas Mount Container */}
      <div
        ref={canvasMountRef}
        data-testid="three-canvas"
        className="absolute inset-0 h-full w-full"
      />

      {/* Screen 1: Tactical Match Lobby */}
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
            onStartGame={startGame}
            onOpenSettings={() => setShowSettings(true)}
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
            weapon={currentWeapon}
            ammoInMag={ammoInMag}
            reserveAmmo={reserveAmmo}
            isReloading={isReloading}
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
            fps={fps}
            showFps={settings.showFps}
            onOpenBuyMenu={() => setShowBuyMenu(true)}
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
              onOpenBuyMenu={() => setShowBuyMenu(true)}
              canPlantOrDefuse={
                (engineRef.current.playerCombatant.team === 'ATTACKERS' && engineRef.current.playerCombatant.hasSpike && spikeState === 'not_planted') ||
                (engineRef.current.playerCombatant.team === 'DEFENDERS' && spikeState === 'planted')
              }
              isPlantingOrDefusing={plantProgress > 0 || defuseProgress > 0}
              touchScale={settings.touchScale}
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
          onBuyWeapon={handleBuyWeapon}
          onBuyShield={handleBuyShield}
          onClose={() => setShowBuyMenu(false)}
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
          onUpdateSettings={(newSettings) => {
            setSettings(newSettings);
            if (engineRef.current) {
              engineRef.current.applySettings(newSettings);
            }
          }}
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
