'use client';

import {
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useState,
} from 'react';
import { useTheme } from 'next-themes';
import { ConstellationEngine } from '@/lib/constellation/engine';
import type { ConstellationApiData, FindMeTarget } from '@/lib/constellation/types';

export interface ConstellationRef {
  findMe: (target: FindMeTarget) => Promise<void>;
  pulseNode: (drepId: string) => void;
}

interface ConstellationProps {
  onReady?: () => void;
  onContracted?: () => void;
  className?: string;
}

export const GovernanceConstellation = forwardRef<ConstellationRef, ConstellationProps>(
  function GovernanceConstellation({ onReady, onContracted, className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<ConstellationEngine | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [ready, setReady] = useState(false);
    const { resolvedTheme } = useTheme();

    useImperativeHandle(ref, () => ({
      findMe: async (target: FindMeTarget) => {
        if (!engineRef.current) return;
        await engineRef.current.findMe(target);
        onContracted?.();
      },
      pulseNode: (drepId: string) => {
        engineRef.current?.pulseNode(drepId);
      },
    }));

    const initEngine = useCallback(async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const theme = (resolvedTheme === 'light' ? 'light' : 'dark') as 'dark' | 'light';
      const isMobile = window.innerWidth < 768;

      const engine = new ConstellationEngine(canvas, theme, reducedMotion);
      engineRef.current = engine;

      try {
        const res = await fetch('/api/governance/constellation');
        if (!res.ok) throw new Error('API error');
        const data: ConstellationApiData = await res.json();

        engine.init(data, isMobile);

        if (reducedMotion) {
          engine.renderStatic();
        } else {
          engine.start();
        }

        setReady(true);
        onReady?.();
      } catch (err) {
        console.error('Constellation init failed:', err);
      }
    }, [resolvedTheme, onReady]);

    useEffect(() => {
      initEngine();

      return () => {
        engineRef.current?.stop();
      };
    }, [initEngine]);

    // Handle resize
    useEffect(() => {
      const handleResize = () => {
        const container = containerRef.current;
        if (!container || !engineRef.current) return;
        engineRef.current.resize(container.clientWidth, container.clientHeight);
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Handle mouse move for parallax
    useEffect(() => {
      const handleMouse = (e: MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas || !engineRef.current) return;
        const rect = canvas.getBoundingClientRect();
        engineRef.current.setMouse(e.clientX - rect.left, e.clientY - rect.top);
      };

      window.addEventListener('mousemove', handleMouse);
      return () => window.removeEventListener('mousemove', handleMouse);
    }, []);

    // Theme sync
    useEffect(() => {
      const theme = (resolvedTheme === 'light' ? 'light' : 'dark') as 'dark' | 'light';
      engineRef.current?.setTheme(theme);
    }, [resolvedTheme]);

    return (
      <div
        ref={containerRef}
        className={`relative w-full ${className || ''}`}
        style={{ minHeight: '100vh' }}
      >
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`}
          role="img"
          aria-label="Interactive visualization of Cardano governance showing DRep representatives as a living constellation"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    );
  }
);
