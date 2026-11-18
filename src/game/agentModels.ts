/**
 * Hollow Strike - Procedural 3D Agent Character Models
 * Composite articulated low-poly humanoid rigs with animated limbs, muzzle flash,
 * hit-flash reaction, death collapse animation, and complete gap-free hitboxes.
 */

import * as THREE from 'three';
import { AgentDef, TeamSide } from './types';
import { createApex9Model, createViper9Model, createPhantomVModel, createVoidLanceModel } from './weaponModels';

export interface AgentMeshPackage {
  root: THREE.Group;
  upperBody: THREE.Group;
  headMesh: THREE.Mesh;
  torsoMesh: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  hitboxMeshes: THREE.Mesh[];
  weaponHolder: THREE.Group;
  currentWeaponMesh: THREE.Group | null;
  updateAnimation: (
    dt: number,
    isMoving: boolean,
    moveSpeed: number,
    isCrouching: boolean,
    isDead: boolean,
    aimPitch?: number,
    isReloading?: boolean
  ) => void;
  triggerMuzzleFlash: () => void;
  triggerHitFlash: () => void;
  setWeapon: (weaponId: string) => void;
  resetPose: () => void;
  dispose: () => void;
}

export function createAgentModel(agent: AgentDef, team: TeamSide): AgentMeshPackage {
  const root = new THREE.Group();
  root.name = `Agent_${agent.name}_${team}`;

  const isAttacker = team === 'ATTACKERS';
  const teamColor = isAttacker ? 0xef4444 : 0x3b82f6;

  // Per-agent cloned materials so hit-flash only affects the struck combatant
  const suitMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.72,
    metalness: 0.18,
  });

  const vestMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.85,
    metalness: 0.22,
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

  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.95,
  });

  // Soft contact shadow underneath (non-raycastable)
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
  contactShadow.raycast = () => {};
  root.add(contactShadow);

  // --- Articulated Upper Body Pivot (hip height ~0.88m) ---
  const upperBody = new THREE.Group();
  upperBody.position.y = 0.88;
  root.add(upperBody);

  // Pelvis / Waist bridge (eliminates torso-to-leg gap)
  const pelvisGeo = new THREE.BoxGeometry(0.52, 0.22, 0.30);
  const pelvisMesh = new THREE.Mesh(pelvisGeo, suitMat);
  pelvisMesh.position.y = 0.04;
  upperBody.add(pelvisMesh);

  // Torso (local y: 0.15 to 0.70 -> world 1.03 to 1.58)
  const torsoGeo = new THREE.BoxGeometry(0.56, 0.56, 0.34);
  const torsoMesh = new THREE.Mesh(torsoGeo, suitMat);
  torsoMesh.position.y = 0.36;
  torsoMesh.castShadow = true;
  upperBody.add(torsoMesh);

  // Armored Plate Carrier / Vest
  const vestGeo = new THREE.BoxGeometry(0.60, 0.46, 0.38);
  const vestMesh = new THREE.Mesh(vestGeo, vestMat);
  vestMesh.position.y = 0.36;
  vestMesh.castShadow = true;
  upperBody.add(vestMesh);

  // Team Shoulder Epaulets
  const epauletGeo = new THREE.BoxGeometry(0.16, 0.10, 0.26);
  const epauletL = new THREE.Mesh(epauletGeo, teamMat);
  epauletL.position.set(-0.34, 0.56, 0);
  upperBody.add(epauletL);

  const epauletR = new THREE.Mesh(epauletGeo, teamMat);
  epauletR.position.set(0.34, 0.56, 0);
  upperBody.add(epauletR);

  // Neck bridge + Head (local y: 0.64 to 1.00 -> world 1.52 to 1.88)
  const neckGeo = new THREE.BoxGeometry(0.22, 0.14, 0.22);
  const neckMesh = new THREE.Mesh(neckGeo, suitMat);
  neckMesh.position.y = 0.65;
  upperBody.add(neckMesh);

  const headGeo = new THREE.BoxGeometry(0.36, 0.36, 0.36);
  const headMesh = new THREE.Mesh(headGeo, suitMat);
  headMesh.position.y = 0.84;
  headMesh.castShadow = true;
  upperBody.add(headMesh);

  // Glowing Visor Strip (faces -Z)
  const visorGeo = new THREE.BoxGeometry(0.37, 0.11, 0.12);
  const visorMesh = new THREE.Mesh(visorGeo, visorMat);
  visorMesh.position.set(0, 0.85, -0.15);
  upperBody.add(visorMesh);

  // Left & Right Arms (articulated from shoulder height)
  const armGeo = new THREE.BoxGeometry(0.16, 0.54, 0.18);
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.38, 0.54, 0);
  const leftArm = new THREE.Mesh(armGeo, suitMat);
  leftArm.position.set(0, -0.22, -0.10);
  leftArm.rotation.x = 0.65; // Reaching towards weapon
  leftArm.castShadow = true;
  leftArmPivot.add(leftArm);
  upperBody.add(leftArmPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.38, 0.54, 0);
  const rightArm = new THREE.Mesh(armGeo, suitMat);
  rightArm.position.set(0, -0.22, -0.12);
  rightArm.rotation.x = 0.78;
  rightArm.castShadow = true;
  rightArmPivot.add(rightArm);
  upperBody.add(rightArmPivot);

  // Weapon Attachment Holder (in Upper Body so it bobs/crouches cleanly)
  const weaponHolder = new THREE.Group();
  weaponHolder.position.set(0.24, 0.34, -0.34);
  upperBody.add(weaponHolder);

  // Muzzle Flash Cone for third-person shots
  const flashGeo = new THREE.ConeGeometry(0.10, 0.28, 6);
  flashGeo.rotateX(-Math.PI / 2);
  const muzzleFlashMesh = new THREE.Mesh(flashGeo, flashMat);
  muzzleFlashMesh.position.set(0, 0.05, -0.75);
  muzzleFlashMesh.visible = false;
  muzzleFlashMesh.raycast = () => {};
  weaponHolder.add(muzzleFlashMesh);

  // --- Articulated Legs Pivoted at Hip (y = 0.88) ---
  const legGeo = new THREE.BoxGeometry(0.21, 0.78, 0.23);
  const bootGeo = new THREE.BoxGeometry(0.22, 0.18, 0.28);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.15, 0.88, 0);
  const leftLeg = new THREE.Mesh(legGeo, suitMat);
  leftLeg.position.set(0, -0.40, 0);
  leftLeg.castShadow = true;
  const leftBoot = new THREE.Mesh(bootGeo, vestMat);
  leftBoot.position.set(0, -0.79, -0.02);
  leftLegPivot.add(leftLeg, leftBoot);
  root.add(leftLegPivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.15, 0.88, 0);
  const rightLeg = new THREE.Mesh(legGeo, suitMat);
  rightLeg.position.set(0, -0.40, 0);
  rightLeg.castShadow = true;
  const rightBoot = new THREE.Mesh(bootGeo, vestMat);
  rightBoot.position.set(0, -0.79, -0.02);
  rightLegPivot.add(rightLeg, rightBoot);
  root.add(rightLegPivot);

  // Tag hitZones on EVERY hitbox mesh
  headMesh.userData = { hitZone: 'head' };
  visorMesh.userData = { hitZone: 'head' };
  neckMesh.userData = { hitZone: 'body' };
  torsoMesh.userData = { hitZone: 'body' };
  vestMesh.userData = { hitZone: 'body' };
  pelvisMesh.userData = { hitZone: 'body' };
  epauletL.userData = { hitZone: 'body' };
  epauletR.userData = { hitZone: 'body' };
  leftArm.userData = { hitZone: 'body' };
  rightArm.userData = { hitZone: 'body' };
  leftLeg.userData = { hitZone: 'leg' };
  rightLeg.userData = { hitZone: 'leg' };
  leftBoot.userData = { hitZone: 'leg' };
  rightBoot.userData = { hitZone: 'leg' };

  const hitboxMeshes: THREE.Mesh[] = [
    headMesh,
    visorMesh,
    neckMesh,
    torsoMesh,
    vestMesh,
    pelvisMesh,
    epauletL,
    epauletR,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    leftBoot,
    rightBoot,
  ];

  let currentWeaponMesh: THREE.Group | null = null;
  let walkPhase = Math.random() * Math.PI * 2;
  let flashTimer = 0;
  let hitFlashTimer = 0;
  let recoilKick = 0;
  let deathFallProgress = 0;

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

  function triggerMuzzleFlash() {
    flashTimer = 0.055;
    recoilKick = 1.0;
    muzzleFlashMesh.visible = true;
    muzzleFlashMesh.rotation.z = Math.random() * Math.PI * 2;
  }

  function triggerHitFlash() {
    hitFlashTimer = 0.13;
    suitMat.emissive.setHex(0xef4444);
    suitMat.emissiveIntensity = 0.9;
    vestMat.emissive.setHex(0xffffff);
    vestMat.emissiveIntensity = 0.7;
  }

  let crouchBlend = 0;
  let moveWeight = 0;

  function resetPose() {
    deathFallProgress = 0;
    hitFlashTimer = 0;
    flashTimer = 0;
    recoilKick = 0;
    crouchBlend = 0;
    moveWeight = 0;
    muzzleFlashMesh.visible = false;
    suitMat.emissive.setHex(0x000000);
    suitMat.emissiveIntensity = 0;
    vestMat.emissive.setHex(0x000000);
    vestMat.emissiveIntensity = 0;
    root.rotation.set(0, 0, 0);
    root.position.y = 0;
    upperBody.position.y = 0.88;
    upperBody.rotation.set(0, 0, 0);
    leftArmPivot.rotation.set(0, 0, 0);
    rightArmPivot.rotation.set(0, 0, 0);
    weaponHolder.position.set(0.24, 0.34, -0.34);
    weaponHolder.rotation.set(0, 0, 0);
    leftLegPivot.rotation.x = 0;
    rightLegPivot.rotation.x = 0;
    leftLegPivot.position.y = 0.88;
    rightLegPivot.position.y = 0.88;
  }

  function updateAnimation(
    dt: number,
    isMoving: boolean,
    moveSpeed: number,
    isCrouching: boolean,
    isDead: boolean,
    aimPitch: number = 0,
    isReloading: boolean = false
  ) {
    // Muzzle flash decay
    if (flashTimer > 0) {
      flashTimer -= dt;
      if (flashTimer <= 0) {
        muzzleFlashMesh.visible = false;
      }
    }

    // Hit flash decay
    if (hitFlashTimer > 0) {
      hitFlashTimer -= dt;
      if (hitFlashTimer <= 0) {
        suitMat.emissive.setHex(0x000000);
        suitMat.emissiveIntensity = 0;
        vestMat.emissive.setHex(0x000000);
        vestMat.emissiveIntensity = 0;
      }
    }

    // Recoil spring decay
    recoilKick = THREE.MathUtils.damp(recoilKick, 0, 18, dt);

    // Eased death fall collapse animation
    if (isDead) {
      deathFallProgress = Math.min(1, deathFallProgress + dt * 3.8);
      const easeOut = 1 - Math.pow(1 - deathFallProgress, 3);
      root.rotation.x = -Math.PI * 0.48 * easeOut;
      root.rotation.z = 0.14 * easeOut;
      root.position.y = 0.2 * easeOut;
      contactShadow.visible = false;
      return;
    }

    contactShadow.visible = true;
    root.rotation.x = THREE.MathUtils.damp(root.rotation.x, 0, 14, dt);
    root.rotation.z = THREE.MathUtils.damp(root.rotation.z, 0, 14, dt);

    // Smooth crouch & locomotion blending
    crouchBlend = THREE.MathUtils.damp(crouchBlend, isCrouching ? 1 : 0, 14, dt);
    const targetMoveWeight = isMoving ? Math.min(1, Math.max(0.25, moveSpeed / 5.4)) : 0;
    moveWeight = THREE.MathUtils.damp(moveWeight, targetMoveWeight, 12, dt);

    const crouchOffset = -0.34 * crouchBlend;

    if (isMoving) {
      walkPhase += dt * Math.max(5.5, moveSpeed * 2.0);
    }

    const stride = Math.sin(walkPhase) * 0.62 * moveWeight;
    const bounce = Math.abs(Math.sin(walkPhase * 2)) * 0.042 * moveWeight;
    const idleBreath = Math.sin(performance.now() * 0.0028 + walkPhase) * 0.014 * (1 - moveWeight);
    const torsoTwist = Math.cos(walkPhase) * 0.065 * moveWeight;

    // Legs blend seamlessly between idle stance, crouch kneel, and stride
    const targetLegL = isMoving ? stride : 0.42 * crouchBlend;
    const targetLegR = isMoving ? -stride : -0.32 * crouchBlend;
    leftLegPivot.rotation.x = THREE.MathUtils.damp(leftLegPivot.rotation.x, targetLegL, 15, dt);
    rightLegPivot.rotation.x = THREE.MathUtils.damp(rightLegPivot.rotation.x, targetLegR, 15, dt);
    leftLegPivot.position.y = 0.88 + crouchOffset * 0.62;
    rightLegPivot.position.y = 0.88 + crouchOffset * 0.62;

    // Upper body tracks vertical pitch + subtle torso twist + crouch lower
    const clampedPitch = Math.max(-0.48, Math.min(0.48, aimPitch));
    upperBody.position.y = THREE.MathUtils.damp(upperBody.position.y, 0.88 + crouchOffset + bounce + idleBreath, 16, dt);
    upperBody.rotation.x = THREE.MathUtils.damp(upperBody.rotation.x, clampedPitch * 0.72 + crouchBlend * 0.12, 16, dt);
    upperBody.rotation.y = THREE.MathUtils.damp(upperBody.rotation.y, torsoTwist, 14, dt);

    // Weapon holder recoil + reload drop gesture
    const reloadDipY = isReloading ? -0.1 : 0;
    const reloadPitch = isReloading ? -0.45 : 0;
    const reloadRoll = isReloading ? 0.32 : 0;

    weaponHolder.position.y = THREE.MathUtils.damp(weaponHolder.position.y, 0.34 + reloadDipY, 14, dt);
    weaponHolder.position.z = THREE.MathUtils.damp(weaponHolder.position.z, -0.34 + recoilKick * 0.085, 22, dt);
    weaponHolder.rotation.x = THREE.MathUtils.damp(weaponHolder.rotation.x, recoilKick * 0.22 + reloadPitch, 18, dt);
    weaponHolder.rotation.z = THREE.MathUtils.damp(weaponHolder.rotation.z, reloadRoll, 14, dt);

    // Arms follow support & recoil naturally
    leftArmPivot.rotation.x = THREE.MathUtils.damp(
      leftArmPivot.rotation.x,
      -stride * 0.28 + (isReloading ? -0.45 : 0),
      15,
      dt
    );
    rightArmPivot.rotation.x = THREE.MathUtils.damp(
      rightArmPivot.rotation.x,
      -recoilKick * 0.16 + (isReloading ? -0.25 : 0),
      18,
      dt
    );
  }

  return {
    root,
    upperBody,
    headMesh,
    torsoMesh,
    leftLeg,
    rightLeg,
    hitboxMeshes,
    weaponHolder,
    currentWeaponMesh,
    updateAnimation,
    triggerMuzzleFlash,
    triggerHitFlash,
    setWeapon,
    resetPose,
    dispose: () => {
      torsoGeo.dispose();
      vestGeo.dispose();
      pelvisGeo.dispose();
      neckGeo.dispose();
      epauletGeo.dispose();
      headGeo.dispose();
      visorGeo.dispose();
      armGeo.dispose();
      legGeo.dispose();
      bootGeo.dispose();
      flashGeo.dispose();
      shadowGeo.dispose();
      suitMat.dispose();
      vestMat.dispose();
      teamMat.dispose();
      visorMat.dispose();
      flashMat.dispose();
      shadowMat.dispose();
    },
  };
}
