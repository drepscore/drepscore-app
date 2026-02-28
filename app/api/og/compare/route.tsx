/**
 * OG Image Generation for DRep Comparison
 * Side-by-side score rings with DRep names for social sharing
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getDRepById } from '@/lib/data';
import { getDRepPrimaryName } from '@/utils/display';

export const runtime = 'edge';

const COLORS = {
  bg: '#0c1222',
  bgGradient: '#162033',
  text: '#ffffff',
  textMuted: '#94a3b8',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  barBg: '#1e293b',
  divider: '#334155',
};

function getTierColor(score: number): string {
  if (score >= 80) return COLORS.green;
  if (score >= 60) return COLORS.amber;
  return COLORS.red;
}

function getTierLabel(score: number): string {
  if (score >= 80) return 'Strong';
  if (score >= 60) return 'Good';
  return 'Low';
}

function ScoreRing({ score, size = 140 }: { score: number; size?: number }) {
  const color = getTierColor(score);
  const label = getTierLabel(score);
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, score)) / 100;
  const dashOffset = circumference * (1 - progress);

  return (
    <div style={{
      display: 'flex',
      position: 'relative',
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <svg
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)', position: 'absolute' }}
      >
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={COLORS.barBg} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color}
          strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={dashOffset}
        />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', fontSize: '44px', fontWeight: 700, color, lineHeight: 1 }}>{score}</div>
        <div style={{ display: 'flex', fontSize: '14px', color: COLORS.textMuted, marginTop: '4px' }}>{label}</div>
      </div>
    </div>
  );
}

export async function GET(request: NextRequest) {
  try {
    const drepsParam = request.nextUrl.searchParams.get('dreps');
    if (!drepsParam) {
      return fallbackImage('No DReps specified');
    }

    const drepIds = drepsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
    if (drepIds.length < 2) {
      return fallbackImage('Need at least 2 DReps');
    }

    const dreps = await Promise.all(drepIds.map(id => getDRepById(id)));
    const valid = dreps.filter(Boolean);
    if (valid.length < 2) {
      return fallbackImage('DRep(s) not found');
    }

    return new ImageResponse(
      (
        <div style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: `linear-gradient(135deg, ${COLORS.bg} 0%, ${COLORS.bgGradient} 100%)`,
          color: COLORS.text,
          fontFamily: 'sans-serif',
          padding: '48px 64px',
          flexDirection: 'column',
        }}>
          {/* Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', fontSize: '28px', fontWeight: 700 }}>DRep Comparison</div>
          </div>

          {/* DRep Cards */}
          <div style={{
            display: 'flex',
            flex: 1,
            gap: '32px',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {valid.map((drep, i) => {
              if (!drep) return null;
              const name = getDRepPrimaryName(drep);
              return (
                <div key={drep.drepId} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flex: 1,
                  padding: '24px',
                  borderRadius: '16px',
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <ScoreRing score={drep.drepScore} />
                  <div style={{
                    display: 'flex',
                    fontSize: '24px',
                    fontWeight: 600,
                    marginTop: '16px',
                    textAlign: 'center',
                    maxWidth: '280px',
                    lineHeight: 1.2,
                  }}>
                    {name.length > 20 ? name.slice(0, 20) + '…' : name}
                  </div>
                  {drep.ticker && (
                    <div style={{ display: 'flex', fontSize: '16px', color: COLORS.textMuted, marginTop: '6px' }}>
                      ${drep.ticker}
                    </div>
                  )}
                  <div style={{ display: 'flex', fontSize: '14px', color: COLORS.textMuted, marginTop: '12px', gap: '8px' }}>
                    <span>{drep.sizeTier}</span>
                    <span>·</span>
                    <span>{drep.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
              );
            })}

            {/* VS divider between cards */}
            {valid.length === 2 && (
              <div style={{
                display: 'flex',
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '32px',
                fontWeight: 700,
                color: COLORS.textMuted,
                opacity: 0.5,
              }}>
                VS
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '16px',
          }}>
            <div style={{ display: 'flex', fontSize: '20px', fontWeight: 600, color: COLORS.textMuted }}>
              DRepScore
            </div>
            <div style={{ display: 'flex', fontSize: '16px', color: COLORS.textMuted }}>
              drepscore.io
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: { 'Cache-Control': 'public, max-age=900, s-maxage=900' },
      }
    );
  } catch (error) {
    console.error('[OG Compare] Error:', error);
    return fallbackImage('Error generating image');
  }
}

function fallbackImage(message: string) {
  return new ImageResponse(
    (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        background: `linear-gradient(135deg, ${COLORS.bg} 0%, ${COLORS.bgGradient} 100%)`,
        color: COLORS.text,
        fontFamily: 'sans-serif',
      }}>
        <div style={{ display: 'flex', fontSize: '48px', fontWeight: 700 }}>DRepScore</div>
        <div style={{ display: 'flex', fontSize: '24px', color: COLORS.textMuted, marginTop: '16px' }}>
          Compare Cardano DReps side by side
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
