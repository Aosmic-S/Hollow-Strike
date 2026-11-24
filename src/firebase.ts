/**
 * Hollow Strike - Firebase Client Integration
 * Firestore Database persistence for PlayerStats, Match History, and Global Leaderboard.
 * Compliant with AI Studio Firebase integration protocols and structured error handling.
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { MatchSummaryPayload, computeRankProgress } from './game/profileStore';
import { PlayerProfile } from './game/types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firebase] Warning: Client is offline. Verify network connection.');
    }
  }
}

testConnection();

export interface CloudUserProfile {
  uid: string;
  callsign: string;
  email?: string;
  photoURL?: string;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  headshots: number;
  damageDealt: number;
  totalMatches: number;
  score: number;
  level: number;
  tier: string;
  favoriteAgentId: string;
  updatedAt: number;
}

export interface CloudMatchRecord {
  id: string;
  uid: string;
  callsign: string;
  mode: string;
  mapId: string;
  won: boolean;
  agentId: string;
  playerTeam: string;
  attackerScore: number;
  defenderScore: number;
  kills: number;
  deaths: number;
  headshots: number;
  damageDealt: number;
  timestamp: number;
}

/**
 * Persist match summary to 'matches' collection and update cumulative 'users' stats in Firestore.
 */
export async function saveMatchSummaryToFirestore(
  user: User,
  summary: MatchSummaryPayload,
  updatedProfile: PlayerProfile,
  mapId = 'COURTYARD'
): Promise<{ matchId: string; success: boolean }> {
  const matchId = `match_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const matchesPath = `matches/${matchId}`;

  const matchRecord: CloudMatchRecord = {
    id: matchId,
    uid: user.uid,
    callsign: updatedProfile.callsign || user.displayName || 'Operative',
    mode: summary.mode,
    mapId,
    won: summary.won,
    agentId: summary.agentId,
    playerTeam: summary.playerTeam,
    attackerScore: summary.attackerScore,
    defenderScore: summary.defenderScore,
    kills: summary.kills,
    deaths: summary.deaths,
    headshots: summary.headshots,
    damageDealt: Math.round(summary.damageDealt),
    timestamp: Date.now(),
  };

  try {
    await setDoc(doc(db, 'matches', matchId), matchRecord);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, matchesPath);
  }

  // Update cumulative user profile
  const userPath = `users/${user.uid}`;
  const rank = computeRankProgress(updatedProfile);
  const userProfileData: CloudUserProfile = {
    uid: user.uid,
    callsign: updatedProfile.callsign || user.displayName || 'Operative',
    email: user.email || '',
    photoURL: user.photoURL || '',
    wins: updatedProfile.wins,
    losses: updatedProfile.losses,
    kills: updatedProfile.kills,
    deaths: updatedProfile.deaths,
    headshots: updatedProfile.headshots,
    damageDealt: updatedProfile.damageDealt,
    totalMatches: updatedProfile.totalMatches,
    score: updatedProfile.kills * 100 + updatedProfile.wins * 500,
    level: rank.level,
    tier: rank.tier,
    favoriteAgentId: updatedProfile.favoriteAgentId || 'KAEL',
    updatedAt: Date.now(),
  };

  try {
    await setDoc(doc(db, 'users', user.uid), userProfileData, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  return { matchId, success: true };
}

/**
 * Synchronize local profile with Firestore on login or manual sync.
 */
export async function syncUserProfileWithFirestore(
  user: User,
  localProfile: PlayerProfile
): Promise<PlayerProfile> {
  const userPath = `users/${user.uid}`;
  let cloudDoc;
  try {
    cloudDoc = await getDoc(doc(db, 'users', user.uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  const rank = computeRankProgress(localProfile);

  if (cloudDoc && cloudDoc.exists()) {
    const cloudData = cloudDoc.data() as Partial<CloudUserProfile>;
    // Merge higher metrics between cloud and local
    const mergedProfile: PlayerProfile = {
      ...localProfile,
      callsign: cloudData.callsign || localProfile.callsign,
      favoriteAgentId: cloudData.favoriteAgentId || localProfile.favoriteAgentId,
      totalMatches: Math.max(localProfile.totalMatches, cloudData.totalMatches ?? 0),
      wins: Math.max(localProfile.wins, cloudData.wins ?? 0),
      losses: Math.max(localProfile.losses, cloudData.losses ?? 0),
      kills: Math.max(localProfile.kills, cloudData.kills ?? 0),
      deaths: Math.max(localProfile.deaths, cloudData.deaths ?? 0),
      headshots: Math.max(localProfile.headshots, cloudData.headshots ?? 0),
      damageDealt: Math.max(localProfile.damageDealt, cloudData.damageDealt ?? 0),
    };
    return mergedProfile;
  }

  // Create initial cloud record
  const initialData: CloudUserProfile = {
    uid: user.uid,
    callsign: localProfile.callsign || user.displayName || 'Operative',
    email: user.email || '',
    photoURL: user.photoURL || '',
    wins: localProfile.wins,
    losses: localProfile.losses,
    kills: localProfile.kills,
    deaths: localProfile.deaths,
    headshots: localProfile.headshots,
    damageDealt: localProfile.damageDealt,
    totalMatches: localProfile.totalMatches,
    score: localProfile.kills * 100 + localProfile.wins * 500,
    level: rank.level,
    tier: rank.tier,
    favoriteAgentId: localProfile.favoriteAgentId || 'KAEL',
    updatedAt: Date.now(),
  };

  try {
    await setDoc(doc(db, 'users', user.uid), initialData, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  return localProfile;
}

/**
 * Fetch top players from Firestore 'users' collection for the Global Leaderboard.
 */
export async function fetchGlobalLeaderboard(
  sortBy: 'wins' | 'kills' | 'score' = 'wins',
  maxCount = 50
): Promise<CloudUserProfile[]> {
  const usersPath = 'users';
  try {
    const usersRef = collection(db, usersPath);
    const q = query(usersRef, orderBy(sortBy, 'desc'), limit(maxCount));
    const querySnapshot = await getDocs(q);

    const results: CloudUserProfile[] = [];
    querySnapshot.forEach((docSnap) => {
      results.push(docSnap.data() as CloudUserProfile);
    });

    return results;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, usersPath);
  }
}

export { signInWithPopup, signOut, onAuthStateChanged };
export type { User };
