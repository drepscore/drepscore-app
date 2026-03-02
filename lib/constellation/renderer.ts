/**
 * Canvas 2D renderer for the governance constellation.
 * Draws nodes with glow effects, edges, particles, and vote pulses
 * across 4 depth layers with optional mouse parallax.
 */

import type { ConstellationState } from './types';
import { getIdentityColor } from '@/lib/drepIdentity';

const PARALLAX_FACTORS = [0.04, 0.02, 0.01, 0]; // layer 0-3

export function render(ctx: CanvasRenderingContext2D, state: ConstellationState) {
  const { width, height, dpr, theme } = state;
  const w = width * dpr;
  const h = height * dpr;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  drawBackground(ctx, width, height, theme);

  const cam = state.camera;
  const parallaxBase = {
    x: (state.mouseX - width / 2) * (state.reducedMotion ? 0 : 1),
    y: (state.mouseY - height / 2) * (state.reducedMotion ? 0 : 1),
  };

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  // Layer 0: Ambient dots
  const pf0 = PARALLAX_FACTORS[0];
  ctx.save();
  ctx.translate(parallaxBase.x * pf0, parallaxBase.y * pf0);
  for (const node of state.nodes) {
    if (node.layer !== 'ambient') continue;
    drawAmbientDot(ctx, node.x, node.y, node.radius, node.opacity, theme);
  }
  ctx.restore();

  // Layer 1: Edges
  const pf1 = PARALLAX_FACTORS[1];
  ctx.save();
  ctx.translate(parallaxBase.x * pf1, parallaxBase.y * pf1);
  const nodeMap = new Map(state.nodes.map(n => [n.id, n]));
  for (const edge of state.edges) {
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    if (!from || !to) continue;
    drawEdge(ctx, from.x, from.y, to.x, to.y, edge.opacity, theme);
  }
  ctx.restore();

  // Layer 2: Visible nodes
  const pf2 = PARALLAX_FACTORS[2];
  ctx.save();
  ctx.translate(parallaxBase.x * pf2, parallaxBase.y * pf2);
  for (const node of state.nodes) {
    if (node.layer !== 'visible') continue;
    drawNode(ctx, node, theme);
  }
  ctx.restore();

  // Layer 3: Effects (no parallax)
  for (const pulse of state.pulses) {
    drawPulse(ctx, pulse);
  }
  for (const particle of state.particles) {
    drawParticle(ctx, particle);
  }

  ctx.restore();
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, theme: 'dark' | 'light') {
  if (theme === 'dark') {
    ctx.fillStyle = '#0a0b14';
    ctx.fillRect(0, 0, w, h);
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
    grad.addColorStop(0, 'rgba(30, 40, 80, 0.4)');
    grad.addColorStop(1, 'rgba(10, 11, 20, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = '#f8f9fc';
    ctx.fillRect(0, 0, w, h);
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
    grad.addColorStop(0, 'rgba(200, 210, 240, 0.3)');
    grad.addColorStop(1, 'rgba(248, 249, 252, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawAmbientDot(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number, opacity: number,
  theme: 'dark' | 'light'
) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = theme === 'dark'
    ? `rgba(180, 190, 220, ${opacity})`
    : `rgba(100, 110, 140, ${opacity})`;
  ctx.fill();
}

function drawEdge(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  opacity: number, theme: 'dark' | 'light'
) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = theme === 'dark'
    ? `rgba(180, 190, 220, ${opacity})`
    : `rgba(100, 110, 140, ${opacity})`;
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

function drawNode(
  ctx: CanvasRenderingContext2D,
  node: { x: number; y: number; radius: number; dominant: string; opacity: number; highlighted: boolean },
  theme: 'dark' | 'light'
) {
  const color = getIdentityColor(node.dominant as any);
  const [r, g, b] = color.rgb;
  const alpha = node.highlighted ? 1 : node.opacity;
  const glowRadius = node.highlighted ? node.radius * 3 : node.radius * 1.5;

  if (theme === 'dark') {
    ctx.save();
    ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${alpha * 0.6})`;
    ctx.shadowBlur = glowRadius;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    ctx.fill();
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.8})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.3})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawPulse(
  ctx: CanvasRenderingContext2D,
  pulse: { x: number; y: number; radius: number; color: string; opacity: number }
) {
  ctx.beginPath();
  ctx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2);
  ctx.strokeStyle = pulse.color.replace(')', `, ${pulse.opacity})`).replace('rgb(', 'rgba(');
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawParticle(
  ctx: CanvasRenderingContext2D,
  particle: { x: number; y: number; size: number; color: string }
) {
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
  ctx.fillStyle = particle.color;
  ctx.fill();
}
