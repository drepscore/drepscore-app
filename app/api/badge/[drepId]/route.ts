import { NextRequest, NextResponse } from 'next/server';
import { getDRepById } from '@/lib/data';
import { getDRepPrimaryName } from '@/utils/display';
import { captureServerEvent } from '@/lib/posthog-server';

function getTierColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

function getTierLabel(score: number): string {
  if (score >= 80) return 'Strong';
  if (score >= 60) return 'Good';
  return 'Low';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ drepId: string }> }
) {
  const { drepId } = await params;
  const drep = await getDRepById(decodeURIComponent(drepId));

  if (!drep) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="28">
      <rect width="180" height="28" rx="4" fill="#1e293b"/>
      <text x="90" y="18" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#94a3b8">DRep Not Found</text>
    </svg>`;
    return new NextResponse(svg, {
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=300' },
    });
  }

  const referer = request.headers.get('referer') || 'direct';
  captureServerEvent('badge_rendered', { drep_id: drepId, referer }, `badge:${drepId}`);

  const name = getDRepPrimaryName(drep);
  const score = drep.drepScore;
  const color = getTierColor(score);
  const tier = getTierLabel(score);
  const displayName = name.length > 20 ? name.slice(0, 18) + '…' : name;

  const labelWidth = 90;
  const scoreWidth = 90;
  const totalWidth = labelWidth + scoreWidth;
  const height = 28;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}">
  <title>${name} — DRepScore ${score}/100 (${tier})</title>
  <rect width="${totalWidth}" height="${height}" rx="4" fill="#1e293b"/>
  <rect x="${labelWidth}" width="${scoreWidth}" height="${height}" rx="0" fill="${color}22"/>
  <rect x="${totalWidth - 4}" y="0" width="4" height="${height}" rx="0" fill="transparent"/>
  <clipPath id="r"><rect width="${totalWidth}" height="${height}" rx="4"/></clipPath>
  <g clip-path="url(#r)">
    <rect x="${labelWidth}" width="${scoreWidth}" height="${height}" fill="${color}22"/>
  </g>
  <text x="8" y="18" font-family="Verdana,Geneva,sans-serif" font-size="11" fill="#e2e8f0" font-weight="600">DRepScore</text>
  <text x="${labelWidth + 8}" y="18" font-family="Verdana,Geneva,sans-serif" font-size="11" fill="${color}" font-weight="700">${score}/100</text>
  <text x="${labelWidth + 56}" y="18" font-family="Verdana,Geneva,sans-serif" font-size="9" fill="${color}cc">${tier}</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=900, s-maxage=900',
    },
  });
}
