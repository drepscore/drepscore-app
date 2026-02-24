/**
 * OG Image Generation for DRep Score Cards
 * Generates shareable 1200x630 images for social media
 */

import { ImageResponse } from 'next/og';
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

function shortenDRepId(drepId: string): string {
  if (drepId.length <= 20) return drepId;
  return `${drepId.slice(0, 12)}...${drepId.slice(-8)}`;
}

interface PillarData {
  label: string;
  value: number;
  maxPoints: number;
}

function PillarBar({ label, value, maxPoints }: PillarData) {
  const percentage = Math.min(100, Math.max(0, (value / maxPoints) * 100));
  const barColor = percentage >= 80 ? COLORS.green : percentage >= 50 ? COLORS.amber : COLORS.red;
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%' }}>
      <div style={{ display: 'flex', width: '140px', fontSize: '18px', color: COLORS.textMuted }}>
        {label}
      </div>
      <div style={{ 
        display: 'flex', 
        flex: 1, 
        height: '24px', 
        backgroundColor: COLORS.barBg, 
        borderRadius: '12px',
        overflow: 'hidden',
      }}>
        <div style={{ 
          display: 'flex',
          width: `${percentage}%`, 
          height: '100%', 
          backgroundColor: barColor,
          borderRadius: '12px',
        }} />
      </div>
      <div style={{ 
        display: 'flex',
        width: '70px', 
        fontSize: '18px', 
        color: COLORS.text, 
        textAlign: 'right',
        fontWeight: 600,
        justifyContent: 'flex-end',
      }}>
        {Math.round(value)}/{maxPoints}
      </div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const color = getTierColor(score);
  const label = getTierLabel(score);
  const size = 180;
  const strokeWidth = 12;
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
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={COLORS.barBg}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ display: 'flex', fontSize: '56px', fontWeight: 700, color, lineHeight: 1 }}>
          {score}
        </div>
        <div style={{ display: 'flex', fontSize: '18px', color: COLORS.textMuted, marginTop: '4px' }}>
          {label}
        </div>
      </div>
    </div>
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ drepId: string }> }
) {
  try {
    const { drepId } = await params;
    const decodedId = decodeURIComponent(drepId);
    const drep = await getDRepById(decodedId);
    
    if (!drep) {
      return new ImageResponse(
        (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              background: `linear-gradient(135deg, ${COLORS.bg} 0%, ${COLORS.bgGradient} 100%)`,
              color: COLORS.text,
              fontFamily: 'sans-serif',
            }}
          >
            <div style={{ display: 'flex', fontSize: '48px', fontWeight: 700 }}>DRepScore</div>
            <div style={{ display: 'flex', fontSize: '24px', color: COLORS.textMuted, marginTop: '16px' }}>
              DRep not found
            </div>
          </div>
        ),
        { width: 1200, height: 630 }
      );
    }

    const name = getDRepPrimaryName(drep);
    
    // Calculate actual point contributions (percentage * weight)
    const pillars: PillarData[] = [
      { label: 'Participation', value: (drep.effectiveParticipation / 100) * 30, maxPoints: 30 },
      { label: 'Rationale', value: (drep.rationaleRate / 100) * 35, maxPoints: 35 },
      { label: 'Reliability', value: (drep.reliabilityScore / 100) * 20, maxPoints: 20 },
      { label: 'Profile', value: (drep.profileCompleteness / 100) * 15, maxPoints: 15 },
    ];

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            background: `linear-gradient(135deg, ${COLORS.bg} 0%, ${COLORS.bgGradient} 100%)`,
            color: COLORS.text,
            fontFamily: 'sans-serif',
            padding: '48px 64px',
          }}
        >
          {/* Left side: Score ring */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            justifyContent: 'center',
            width: '280px',
            marginRight: '48px',
          }}>
            <ScoreRing score={drep.drepScore} />
          </div>
          
          {/* Right side: Info and pillars */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            flex: 1,
            justifyContent: 'center',
          }}>
            {/* DRep name and ID */}
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '32px' }}>
              <div style={{ 
                display: 'flex',
                fontSize: '42px', 
                fontWeight: 700, 
                color: COLORS.text,
                lineHeight: 1.2,
              }}>
                {name}
              </div>
              <div style={{ 
                display: 'flex',
                fontSize: '18px', 
                color: COLORS.textMuted, 
                marginTop: '8px',
                fontFamily: 'monospace',
              }}>
                {shortenDRepId(drep.drepId)}
              </div>
            </div>
            
            {/* Pillar bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {pillars.map((pillar) => (
                <PillarBar key={pillar.label} {...pillar} />
              ))}
            </div>
          </div>
          
          {/* Footer branding */}
          <div style={{ 
            display: 'flex', 
            position: 'absolute',
            bottom: '32px',
            left: '64px',
            right: '64px',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{ display: 'flex', fontSize: '24px', fontWeight: 600, color: COLORS.textMuted }}>
              DRepScore
            </div>
            <div style={{ display: 'flex', fontSize: '18px', color: COLORS.textMuted }}>
              drepscore-app.vercel.app
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'public, max-age=900, s-maxage=900',
        },
      }
    );
  } catch (error) {
    console.error('[OG] Error generating image:', error);
    
    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            background: `linear-gradient(135deg, ${COLORS.bg} 0%, ${COLORS.bgGradient} 100%)`,
            color: COLORS.text,
            fontFamily: 'sans-serif',
          }}
        >
          <div style={{ display: 'flex', fontSize: '48px', fontWeight: 700 }}>DRepScore</div>
          <div style={{ display: 'flex', fontSize: '24px', color: COLORS.textMuted, marginTop: '16px' }}>
            Find your ideal Cardano DRep
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }
}
