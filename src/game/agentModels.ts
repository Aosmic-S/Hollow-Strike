/**
 * Hollow Strike - Procedural 3D Agent Character Models
 * 8-part composite low-poly humanoid characters with distinct visors, team colors, and hitboxes.
 */

import * as THREE from 'three';
import { AgentDef, TeamSide } from './types';
import { createApex9Model, createViper9Model, createPhantomVModel, createVoidLanceModel } from './weaponModels';

export interface AgentMeshPackage {
  root: THREE.Group;
  headMesh: THREE.Mesh;
  torsoMesh: THREE.Mesh;
  legsMesh: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  weaponHolder: THREE.Group;
  currentWeaponMesh: THREE.Group | null;
  updateAnimation: (isMoving: boolean, moveDistance: number, isCrouching: boolean) => void;
  setWeapon: (weaponId: string) => void;
  dispose: () => void;
}

export function createAgentModel(agent: AgentDef, team: TeamSide): AgentMeshPackage {
  const root = new THREE.Group();
  root.name = `Agent_${agent.name}_${team}`;

  const isAttacker = team === 'ATTACKERS';
  const teamColor = isAttacker ? 0xdc2626 : 0x2563eb; // Crimson vs Cobalt

  // Materials
  const suitMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.75,
    metalness: 0.15,
  });

  const vestMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.85,
    metalness: 0.2,
  });

  const teamMat = new THREE.MeshStandardMaterial({
    color: teamColor,
    roughness: 0.4,
    metalness: 0.4,
  });

  const visorMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(agent.primaryColor),
    emissive: new THREE.Color(agent.primaryColor),
    emissiveIntensity: 0.9,
    roughness: 0.1,
    metalness: 0.9,
  });

  // Soft contact shadow underneath
  const shadowGeo = new THREE.CircleGeometry(0.55, 16);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.02;
  root.add(contactShadow);

  // --- Torso & Vest (Height: ~0.9 to 1.45) ---
  const torsoGeo = new THREE.BoxGeometry(0.55, 0.55, 0.32);
  const torsoMesh = new THREE.Mesh(torsoGeo, suitMat);
  torsoMesh.position.y = 1.18;
  torsoMesh.castShadow = true;
  root.add(torsoMesh);

  // Armored Plate Carrier / Vest
  const vestGeo = new THREE.BoxGeometry(0.58, 0.45, 0.36);
  const vestMesh = new THREE.Mesh(vestGeo, vestMat);
  vestMesh.position.y = 1.2;
  vestMesh.castShadow = true;
  root.add(vestMesh);

  // Team Shoulder Epaulets
  const epauletGeo = new THREE.BoxGeometry(0.14, 0.08, 0.24);
  const epauletL = new THREE.Mesh(epauletGeo, teamMat);
  epauletL.position.set(-0.32, 1.4, 0);
  root.add(epauletL);

  const epauletR = new THREE.Mesh(epauletGeo, teamMat);
  epauletR.position.set(0.32, 1.4, 0);
  root.add(epauletR);

  // --- Head & Tactical Helmet / Visor (Height: 1.55 to 1.85) ---
  const headGeo = new THREE.BoxGeometry(0.32, 0.34, 0.34);
  const headMesh = new THREE.Mesh(headGeo, suitMat);
  headMesh.position.y = 1.68;
  headMesh.castShadow = true;
  root.add(headMesh);

  // Visor Strip
  const visorGeo = new THREE.BoxGeometry(0.34, 0.1, 0.12);
  const visorMesh = new THREE.Mesh(visorGeo, visorMat);
  visorMesh.position.set(0, 1.68, -0.16);
  root.add(visorMesh);

  // --- Legs & Boots (Height: 0 to 0.9) ---
  const legGeo = new THREE.BoxGeometry(0.18, 0.85, 0.2);
  const leftLeg = new THREE.Mesh(legGeo, suitMat);
  leftLeg.position.set(-0.16, 0.45, 0);
  leftLeg.castShadow = true;
  root.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, suitMat);
  rightLeg.position.set(0.16, 0.45, 0);
  rightLeg.castShadow = true;
  root.add(rightLeg);

  // Boots
  const bootGeo = new THREE.BoxGeometry(0.2, 0.18, 0.26);
  const leftBoot = new THREE.Mesh(bootGeo, vestMat);
  leftBoot.position.set(-0.16, 0.1, -0.02);
  root.add(leftBoot);

  const rightBoot = new THREE.Mesh(bootGeo, vestMat);
  rightBoot.position.set(0.16, 0.1, -0.02);
  root.add(rightBoot);

  // Hitbox tags for raycast damage routing
  headMesh.userData = { hitZone: 'head' };
  torsoMesh.userData = { hitZone: 'body' };
  vestMesh.userData = { hitZone: 'body' };
  leftLeg.userData = { hitZone: 'leg' };
  rightLeg.userData = { hitZone: 'leg' };

  // --- Weapon Attachment Holder ---
  const weaponHolder = new THREE.Group();
  weaponHolder.position.set(0.2, 1.1, -0.3);
  root.add(weaponHolder);

  let currentWeaponMesh: THREE.Group | null = null;

  function setWeapon(weaponId: string) {
    if (currentWeaponMesh) {
      weaponHolder.remove(currentWeaponMesh);
    }

    switch (weaponId) {
      case 'APEX_9':
        currentWeaponMesh = createApex9Model();
        break;
      case 'VIPER_9':
        currentWeaponMesh = createViper9Model();
        break;
      case 'PHANTOM_V':
        currentWeaponMesh = createPhantomVModel();
        break;
      case 'VOID_LANCE':
        currentWeaponMesh = createVoidLanceModel();
        break;
      default:
        currentWeaponMesh = createApex9Model();
    }

    currentWeaponMesh.scale.set(1.4, 1.4, 1.4);
    weaponHolder.add(currentWeaponMesh);
  }

  setWeapon('APEX_9');

  function updateAnimation(isMoving: boolean, moveDistance: number, isCrouching: boolean) {
    if (isMoving) {
      const legAngle = Math.sin(moveDistance * 4.5) * 0.45;
      leftLeg.rotation.x = legAngle;
      rightLeg.rotation.x = -legAngle;
      torsoMesh.position.y = 1.18 + Math.abs(Math.sin(moveDistance * 9)) * 0.04;
      headMesh.position.y = 1.68 + Math.abs(Math.sin(moveDistance * 9)) * 0.04;
    } else {
      leftLeg.rotation.x = 0;
      rightLeg.rotation.x = 0;
      torsoMesh.position.y = isCrouching ? 0.85 : 1.18;
      headMesh.position.y = isCrouching ? 1.35 : 1.68;
    }

    if (isCrouching) {
      root.scale.y = 0.75;
    } else {
      root.scale.y = 1.0;
    }
  }

  return {
    root,
    headMesh,
    torsoMesh,
    legsMesh: leftLeg,
    leftLeg,
    rightLeg,
    weaponHolder,
    currentWeaponMesh,
    updateAnimation,
    setWeapon,
    dispose: () => {
      torsoGeo.dispose();
      vestGeo.dispose();
      epauletGeo.dispose();
      headGeo.dispose();
      visorGeo.dispose();
      legGeo.dispose();
      bootGeo.dispose();
      shadowGeo.dispose();
      suitMat.dispose();
      vestMat.dispose();
      teamMat.dispose();
      visorMat.dispose();
      shadowMat.dispose();
    },
  };
}
