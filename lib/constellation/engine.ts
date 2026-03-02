/**
 * Constellation animation engine.
 * Manages the render loop, particle system, vote pulses, camera transitions,
 * and the "find me" animation for wallet connect.
 */

import type {
  ConstellationState, ConstellationNode, Particle, VotePulse,
  ConstellationEvent, FindMeTarget, ConstellationApiData,
} from './types';
import { computeLayout } from './layout';
import { render } from './renderer';
import { getIdentityColor } from '@/lib/drepIdentity';

const MAX_PARTICLES = 50;
const MAX_PULSES = 3;
const PULSE_SPEED = 80; // px/s
const PULSE_MAX_RADIUS = 60;
const PARTICLE_SPEED_MIN = 30;
const PARTICLE_SPEED_MAX = 60;
const CAMERA_LERP = 0.04;
const FIND_ME_ZOOM = 2.5;
const CONTRACTED_ZOOM = 1;

export class ConstellationEngine {
  private state: ConstellationState;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private raf: number | null = null;
  private lastTime = 0;
  private eventQueue: ConstellationEvent[] = [];
  private eventTimer = 0;
  private materializeProgress = 0;
  private onContracted: (() => void) | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    theme: 'dark' | 'light',
    reducedMotion: boolean
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.state = {
      nodes: [],
      edges: [],
      particles: [],
      pulses: [],
      camera: { x: 0, y: 0, zoom: 1, targetX: 0, targetY: 0, targetZoom: 1 },
      mouseX: 0,
      mouseY: 0,
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
      theme,
      animating: false,
      contracted: false,
      reducedMotion,
    };
  }

  init(data: ConstellationApiData, isMobile: boolean) {
    const { width, height, dpr } = this.state;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;

    const { nodes, edges } = computeLayout(data.nodes, width, height, isMobile);
    this.state.nodes = nodes;
    this.state.edges = edges;
    this.state.camera.x = width / 2;
    this.state.camera.y = height / 2;
    this.state.camera.targetX = width / 2;
    this.state.camera.targetY = height / 2;

    this.eventQueue = [...data.recentEvents];
    this.materializeProgress = 0;
  }

  start() {
    if (this.raf) return;
    this.state.animating = true;
    this.lastTime = performance.now();
    this.tick(this.lastTime);
  }

  stop() {
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
    this.state.animating = false;
  }

  resize(width: number, height: number) {
    this.state.width = width;
    this.state.height = height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.state.dpr = dpr;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
  }

  setTheme(theme: 'dark' | 'light') {
    this.state.theme = theme;
  }

  setMouse(x: number, y: number) {
    this.state.mouseX = x;
    this.state.mouseY = y;
  }

  /**
   * Trigger a "find me" animation based on user segment.
   * Returns a promise that resolves when the canvas has contracted.
   */
  findMe(target: FindMeTarget): Promise<void> {
    return new Promise<void>(resolve => {
      this.onContracted = resolve;

      if (target.type === 'undelegated') {
        this.showUndelegatedParticle();
        return;
      }

      const drepId = target.drepId;
      if (!drepId) { resolve(); return; }

      const node = this.state.nodes.find(n => n.id === drepId);
      if (!node) { resolve(); return; }

      // Fade other nodes
      for (const n of this.state.nodes) {
        if (n.id === drepId) {
          n.highlighted = true;
          n.opacity = 1;
        } else {
          n.opacity = 0.15;
        }
      }

      // Zoom to the node
      this.state.camera.targetX = node.x;
      this.state.camera.targetY = node.y;
      this.state.camera.targetZoom = FIND_ME_ZOOM;

      if (target.type === 'delegated') {
        this.addDelegationTrace(node);
      }

      // After 2s, contract
      setTimeout(() => this.contract(), 2000);
    });
  }

  /**
   * Highlight a node by DRep ID (used by discovery preview hover).
   */
  pulseNode(drepId: string) {
    const node = this.state.nodes.find(n => n.id === drepId);
    if (!node) return;

    const color = getIdentityColor(node.dominant);
    this.state.pulses.push({
      x: node.x,
      y: node.y,
      radius: node.radius,
      maxRadius: PULSE_MAX_RADIUS,
      color: `rgb(${color.rgb.join(',')})`,
      opacity: 0.6,
      speed: PULSE_SPEED,
    });
  }

  /**
   * Add an event to the constellation (from ticker polling).
   */
  addEvent(event: ConstellationEvent) {
    this.eventQueue.push(event);
  }

  /**
   * Render a single static frame (for reduced-motion / screenshot).
   */
  renderStatic() {
    this.materializeProgress = 1;
    for (const n of this.state.nodes) {
      n.opacity = n.layer === 'visible' ? (0.7 + n.power * 0.3) : (0.2 + 0.1);
    }
    render(this.ctx, this.state);
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private tick = (now: number) => {
    const dt = Math.min((now - this.lastTime) / 1000, 0.05); // cap at 50ms
    this.lastTime = now;

    this.updateCamera(dt);
    this.updateMaterialize(dt);
    this.updateParticles(dt);
    this.updatePulses(dt);
    this.processEventQueue(dt);

    render(this.ctx, this.state);

    if (this.state.animating) {
      this.raf = requestAnimationFrame(this.tick);
    }
  };

  private updateCamera(dt: number) {
    const cam = this.state.camera;
    const lerp = 1 - Math.pow(1 - CAMERA_LERP, dt * 60);
    cam.x += (cam.targetX - cam.x) * lerp;
    cam.y += (cam.targetY - cam.y) * lerp;
    cam.zoom += (cam.targetZoom - cam.zoom) * lerp;
  }

  private updateMaterialize(dt: number) {
    if (this.materializeProgress >= 1) return;
    this.materializeProgress = Math.min(1, this.materializeProgress + dt * 1.2);
    const p = easeOutCubic(this.materializeProgress);

    for (const node of this.state.nodes) {
      const cx = this.state.width / 2;
      const cy = this.state.height / 2;
      const distFromCenter = Math.sqrt(
        (node.x - cx) ** 2 + (node.y - cy) ** 2
      );
      const maxDist = Math.min(this.state.width, this.state.height) * 0.5;
      const nodeProgress = Math.max(0, p - (distFromCenter / maxDist) * 0.3);
      const base = node.layer === 'visible' ? (0.7 + node.power * 0.3) : (0.2 + Math.random() * 0.1);
      node.opacity = base * Math.min(1, nodeProgress * 2);
    }
  }

  private updateParticles(dt: number) {
    if (this.state.reducedMotion) return;

    // Spawn particles occasionally
    if (this.state.particles.length < MAX_PARTICLES && Math.random() < dt * 2) {
      this.spawnParticle();
    }

    // Update existing
    for (let i = this.state.particles.length - 1; i >= 0; i--) {
      const p = this.state.particles[i];
      p.progress += p.speed * dt;
      p.x += (p.targetX - p.x) * p.speed * dt;
      p.y += (p.targetY - p.y) * p.speed * dt;

      if (p.progress >= 1) {
        this.state.particles.splice(i, 1);
      }
    }
  }

  private updatePulses(dt: number) {
    if (this.state.reducedMotion) return;

    for (let i = this.state.pulses.length - 1; i >= 0; i--) {
      const pulse = this.state.pulses[i];
      pulse.radius += pulse.speed * dt;
      pulse.opacity = Math.max(0, 0.6 * (1 - pulse.radius / pulse.maxRadius));

      if (pulse.radius >= pulse.maxRadius) {
        this.state.pulses.splice(i, 1);
      }
    }
  }

  private processEventQueue(dt: number) {
    if (this.state.reducedMotion) return;

    this.eventTimer += dt;
    if (this.eventTimer < 3 || this.eventQueue.length === 0) return;
    this.eventTimer = 0;

    const event = this.eventQueue.shift()!;
    const node = this.state.nodes.find(n =>
      n.id === event.drepId || event.drepId.startsWith(n.id)
    );
    if (!node) return;

    if (event.type === 'vote' && event.vote) {
      const voteColors: Record<string, string> = {
        Yes: 'rgb(34, 197, 94)',
        No: 'rgb(239, 68, 68)',
        Abstain: 'rgb(245, 158, 11)',
      };
      this.state.pulses.push({
        x: node.x,
        y: node.y,
        radius: node.radius,
        maxRadius: PULSE_MAX_RADIUS,
        color: voteColors[event.vote] || 'rgb(180, 190, 220)',
        opacity: 0.6,
        speed: PULSE_SPEED,
      });
    }
  }

  private spawnParticle() {
    const visibleNodes = this.state.nodes.filter(n => n.layer === 'visible');
    if (visibleNodes.length < 2) return;

    const from = visibleNodes[Math.floor(Math.random() * visibleNodes.length)];
    const to = visibleNodes[Math.floor(Math.random() * visibleNodes.length)];
    if (from.id === to.id) return;

    const color = getIdentityColor(from.dominant);
    this.state.particles.push({
      x: from.x,
      y: from.y,
      targetX: to.x,
      targetY: to.y,
      progress: 0,
      speed: PARTICLE_SPEED_MIN + Math.random() * (PARTICLE_SPEED_MAX - PARTICLE_SPEED_MIN),
      color: `rgba(${color.rgb.join(',')}, 0.6)`,
      size: 1.5,
    });
  }

  private addDelegationTrace(targetNode: ConstellationNode) {
    const color = getIdentityColor(targetNode.dominant);
    const startX = this.state.width * 0.1;
    const startY = this.state.height * 0.9;

    for (let i = 0; i < 5; i++) {
      this.state.particles.push({
        x: startX + Math.random() * 20,
        y: startY + Math.random() * 20,
        targetX: targetNode.x,
        targetY: targetNode.y,
        progress: 0,
        speed: 0.3 + i * 0.05,
        color: `rgba(${color.rgb.join(',')}, 0.8)`,
        size: 2,
      });
    }
  }

  private showUndelegatedParticle() {
    const edgeX = this.state.width * 0.85;
    const edgeY = this.state.height * 0.75;

    this.state.nodes.push({
      id: '__user__',
      name: 'You',
      power: 0,
      score: 0,
      dominant: 'transparency',
      alignments: [50, 50, 50, 50, 50, 50],
      x: edgeX,
      y: edgeY,
      radius: 5,
      layer: 'visible',
      highlighted: true,
      opacity: 1,
    });

    // Dangling line
    this.state.edges.push({
      from: '__user__',
      to: '__user__',
      opacity: 0.3,
    });

    // Slight camera move toward the lone particle
    this.state.camera.targetX = (this.state.width / 2 + edgeX) / 2;
    this.state.camera.targetY = (this.state.height / 2 + edgeY) / 2;
    this.state.camera.targetZoom = 1.3;

    setTimeout(() => this.contract(), 2000);
  }

  private contract() {
    this.state.contracted = true;
    this.state.camera.targetX = this.state.width / 2;
    this.state.camera.targetY = this.state.height / 2;
    this.state.camera.targetZoom = CONTRACTED_ZOOM;

    // Restore node opacities
    for (const n of this.state.nodes) {
      if (n.id === '__user__') continue;
      const base = n.layer === 'visible' ? (0.7 + n.power * 0.3) : 0.25;
      n.opacity = base;
      n.highlighted = false;
    }

    setTimeout(() => {
      this.onContracted?.();
      this.onContracted = null;
    }, 800);
  }
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
