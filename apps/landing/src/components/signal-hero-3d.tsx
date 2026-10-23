'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface SignalHero3DProps {
  onWebGLUnavailable?: () => void;
}

/**
 * Cena Three.js do objeto 3D do Hero da landing editorial (01-landing-desktop.png).
 * Apresenta o anel do sinal e esferas com materiais físicos (MeshPhysicalMaterial
 * com clearcoat e transmission), iluminação de estúdio, flutuação lenta e parallax suave.
 */
export default function SignalHero3D({ onWebGLUnavailable }: SignalHero3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Detecção de WebGL
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
      if (!gl) {
        onWebGLUnavailable?.();
        return;
      }
    } catch {
      onWebGLUnavailable?.();
      return;
    }

    let animationFrameId: number;
    let renderer: THREE.WebGLRenderer | null = null;

    try {
      const width = container.clientWidth || 520;
      const height = container.clientHeight || 520;

      // Cena e Câmera
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
      camera.position.set(0, 0, 8.8);

      // Renderer
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      container.appendChild(renderer.domElement);

      // Grupo raiz para rotação/flutuação e parallax
      const heroGroup = new THREE.Group();
      scene.add(heroGroup);

      // Luzes de Estúdio
      const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
      scene.add(ambientLight);

      // Luz direcional principal (Key light - branco suave do topo esquerdo)
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
      keyLight.position.set(5, 8, 7);
      scene.add(keyLight);

      // Luz de realce elétrico (Rim light - azul elétrico de baixo)
      const rimLight = new THREE.DirectionalLight(0x4c8dff, 3.2);
      rimLight.position.set(-6, -4, 4);
      scene.add(rimLight);

      // Luz de preenchimento suave (Sinal claro)
      const fillLight = new THREE.DirectionalLight(0xb9d8ef, 1.5);
      fillLight.position.set(0, -6, -2);
      scene.add(fillLight);

      // Luz pontual para a esfera lima (verde suave)
      const limeLight = new THREE.PointLight(0xd4f56a, 2.0, 8);
      limeLight.position.set(2.4, 2.4, 2);
      scene.add(limeLight);

      // Materiais Físicos (clearcoat, transmission, roughness realista)
      const ringMaterial = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#2563EB'),
        roughness: 0.18,
        metalness: 0.12,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
        transmission: 0.12,
        ior: 1.45,
        reflectivity: 0.9,
      });

      const innerRimMaterial = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#4C8DFF'),
        roughness: 0.22,
        metalness: 0.1,
        clearcoat: 0.8,
        clearcoatRoughness: 0.1,
      });

      const blueSphereMaterial = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#2563EB'),
        roughness: 0.16,
        metalness: 0.15,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
        reflectivity: 0.95,
      });

      const limeSphereMaterial = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#D4F56A'),
        roughness: 0.22,
        metalness: 0.05,
        clearcoat: 0.9,
        clearcoatRoughness: 0.1,
      });

      const paleSphereMaterial = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#B9D8EF'),
        roughness: 0.14,
        metalness: 0.08,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        transmission: 0.35,
        ior: 1.48,
      });

      const darkSphereMaterial = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#0B1220'),
        roughness: 0.2,
        metalness: 0.3,
        clearcoat: 0.9,
        clearcoatRoughness: 0.1,
      });

      // Anel do Sinal de Oportunidade
      // Geometria de Torus principal
      const ringGroup = new THREE.Group();
      const mainRingGeo = new THREE.TorusGeometry(2.1, 0.44, 32, 100);
      const mainRingMesh = new THREE.Mesh(mainRingGeo, ringMaterial);
      ringGroup.add(mainRingMesh);

      // Friso interno do anel
      const innerRingGeo = new THREE.TorusGeometry(1.78, 0.16, 24, 80);
      const innerRingMesh = new THREE.Mesh(innerRingGeo, innerRimMaterial);
      ringGroup.add(innerRingMesh);

      // Inclinação do anel para ângulo de visão editorial
      ringGroup.position.set(0.6, 0.2, 0);
      ringGroup.rotation.set(-0.15, -0.22, 0.1);
      heroGroup.add(ringGroup);

      // Esferas em volume
      // 1. Esfera Lima (topo direito)
      const limeSphereGeo = new THREE.SphereGeometry(0.55, 64, 64);
      const limeSphereMesh = new THREE.Mesh(limeSphereGeo, limeSphereMaterial);
      limeSphereMesh.position.set(2.4, 2.1, 0.4);
      heroGroup.add(limeSphereMesh);

      // 2. Esfera Azul Grande (frente esquerda, na base do anel)
      const blueSphereGeo = new THREE.SphereGeometry(0.85, 64, 64);
      const blueSphereMesh = new THREE.Mesh(blueSphereGeo, blueSphereMaterial);
      blueSphereMesh.position.set(-1.8, -1.3, 1.2);
      heroGroup.add(blueSphereMesh);

      // 3. Esfera Sinal Clara (meio esquerda, translúcida)
      const paleSphereGeo = new THREE.SphereGeometry(0.65, 64, 64);
      const paleSphereMesh = new THREE.Mesh(paleSphereGeo, paleSphereMaterial);
      paleSphereMesh.position.set(-1.2, -0.4, 0.2);
      heroGroup.add(paleSphereMesh);

      // 4. Esfera Escura Grafite (fundo sutil)
      const darkSphereGeo = new THREE.SphereGeometry(0.38, 48, 48);
      const darkSphereMesh = new THREE.Mesh(darkSphereGeo, darkSphereMaterial);
      darkSphereMesh.position.set(2.8, -1.6, -0.6);
      heroGroup.add(darkSphereMesh);

      // Controle de Parallax e Flutuação
      let mouseX = 0;
      let mouseY = 0;
      let targetX = 0;
      let targetY = 0;

      const handlePointerMove = (e: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        targetX = x * 1.5;
        targetY = y * 1.5;
      };

      window.addEventListener('mousemove', handlePointerMove, { passive: true });

      // Loop de animação
      const clock = new THREE.Clock();

      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);

        const elapsedTime = clock.getElapsedTime();

        // Interpolação suave do mouse (parallax lerp)
        mouseX += (targetX - mouseX) * 0.05;
        mouseY += (targetY - mouseY) * 0.05;

        // Flutuação lenta (ondulação suave senoidal)
        heroGroup.position.y = Math.sin(elapsedTime * 0.9) * 0.12 - mouseY * 0.35;
        heroGroup.position.x = mouseX * 0.4;

        // Rotação sutil do anel e conjunto
        ringGroup.rotation.x = -0.15 + Math.sin(elapsedTime * 0.7) * 0.04 - mouseY * 0.2;
        ringGroup.rotation.y = -0.22 + Math.cos(elapsedTime * 0.5) * 0.05 + mouseX * 0.25;

        // Órbitas leves das esferas para sensação orgânica de profundidade
        limeSphereMesh.position.y = 2.1 + Math.sin(elapsedTime * 1.1 + 1.0) * 0.08;
        limeSphereMesh.position.x = 2.4 + Math.cos(elapsedTime * 0.8 + 0.5) * 0.06;

        blueSphereMesh.position.y = -1.3 + Math.sin(elapsedTime * 0.85 + 2.0) * 0.07;
        paleSphereMesh.position.y = -0.4 + Math.cos(elapsedTime * 1.0 + 1.5) * 0.06;

        renderer?.render(scene, camera);
      };

      animate();

      // Redimensionamento responsivo
      const handleResize = () => {
        if (!container || !renderer) return;
        const newW = container.clientWidth || 520;
        const newH = container.clientHeight || 520;
        camera.aspect = newW / newH;
        camera.updateProjectionMatrix();
        renderer.setSize(newW, newH);
      };

      window.addEventListener('resize', handleResize);

      // Limpeza completa ao desmontar
      return () => {
        window.removeEventListener('mousemove', handlePointerMove);
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(animationFrameId);

        mainRingGeo.dispose();
        innerRingGeo.dispose();
        limeSphereGeo.dispose();
        blueSphereGeo.dispose();
        paleSphereGeo.dispose();
        darkSphereGeo.dispose();

        ringMaterial.dispose();
        innerRimMaterial.dispose();
        blueSphereMaterial.dispose();
        limeSphereMaterial.dispose();
        paleSphereMaterial.dispose();
        darkSphereMaterial.dispose();

        if (renderer) {
          renderer.dispose();
          if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement);
          }
        }
      };
    } catch {
      onWebGLUnavailable?.();
    }
  }, [onWebGLUnavailable]);

  return (
    <div
      ref={mountRef}
      className="relative w-full h-full min-h-[380px] sm:min-h-[460px] lg:min-h-[520px] flex items-center justify-center pointer-events-none"
      aria-hidden="true"
    />
  );
}
