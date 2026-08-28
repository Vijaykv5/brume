"use client";

import { Billboard } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

export type BuildingBadgeProps = {
  title: string;
  subtitle: string;
  width: number;
  height: number;
  backgroundColor?: string;
  borderColor?: string;
  titleColor?: string;
  subtitleColor?: string;
};

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const right = x + width;
  const bottom = y + height;

  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(right - radius, y);
  context.quadraticCurveTo(right, y, right, y + radius);
  context.lineTo(right, bottom - radius);
  context.quadraticCurveTo(right, bottom, right - radius, bottom);
  context.lineTo(x + radius, bottom);
  context.quadraticCurveTo(x, bottom, x, bottom - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

export function BuildingBadge({
  title,
  subtitle,
  width,
  height,
  backgroundColor = "#241f12",
  borderColor = "#ffd400",
  titleColor = "#ffd400",
  subtitleColor = "#fff2cf",
}: BuildingBadgeProps) {
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;

    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;

    const context = canvas.getContext("2d");
    if (!context) return null;

    context.clearRect(0, 0, canvas.width, canvas.height);

    const inset = 26;
    drawRoundedRect(
      context,
      inset,
      inset,
      canvas.width - inset * 2,
      canvas.height - inset * 2,
      72,
    );
    context.fillStyle = backgroundColor;
    context.fill();
    context.lineWidth = 16;
    context.strokeStyle = borderColor;
    context.stroke();

    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = titleColor;
    context.font = '800 102px "Inter", Arial, sans-serif';
    context.fillText(title, canvas.width / 2, canvas.height * 0.39, canvas.width * 0.82);

    context.fillStyle = subtitleColor;
    context.font = '800 86px "Inter", Arial, sans-serif';
    context.fillText(subtitle, canvas.width / 2, canvas.height * 0.66, canvas.width * 0.76);

    const nextTexture = new THREE.CanvasTexture(canvas);
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.minFilter = THREE.LinearFilter;
    nextTexture.magFilter = THREE.LinearFilter;
    nextTexture.needsUpdate = true;
    return nextTexture;
  }, [backgroundColor, borderColor, subtitle, subtitleColor, title, titleColor]);

  useEffect(() => () => texture?.dispose(), [texture]);

  if (!texture) return null;

  return (
    <Billboard follow>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          map={texture}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </Billboard>
  );
}
