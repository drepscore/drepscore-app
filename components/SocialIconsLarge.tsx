'use client';

import { extractSocialPlatform } from '@/utils/display';
import {
  SiX,
  SiGithub,
  SiFacebook,
  SiInstagram,
  SiYoutube,
  SiDiscord,
  SiTelegram,
  SiReddit,
  SiMedium,
  SiGitlab,
  SiLinktree,
  SiWhatsapp,
  SiBluesky,
  SiMastodon,
  SiTwitch,
} from '@icons-pack/react-simple-icons';
import { Linkedin, Globe, Link as LinkIcon } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SocialIconsLargeProps {
  metadata?: Record<string, unknown> | null;
  references?: Array<{ uri: string; label?: string }>;
}

const BRAND_ICONS: Record<string, React.FC<{ className?: string; size?: number }>> = {
  'Twitter/X': SiX,
  'GitHub': SiGithub,
  'Facebook': SiFacebook,
  'Instagram': SiInstagram,
  'YouTube': SiYoutube,
  'Discord': SiDiscord,
  'Telegram': SiTelegram,
  'Reddit': SiReddit,
  'Medium': SiMedium,
  'GitLab': SiGitlab,
  'Linktree': SiLinktree,
  'WhatsApp': SiWhatsapp,
  'Bluesky': SiBluesky,
  'Mastodon': SiMastodon,
  'Twitch': SiTwitch,
};

const ECOSYSTEM_PLATFORMS = new Set(['Cardano Foundation', 'IOHK', 'EMURGO']);

function getIcon(platform: string) {
  if (platform === 'LinkedIn') return <Linkedin className="h-5 w-5" />;
  const BrandIcon = BRAND_ICONS[platform];
  if (BrandIcon) return <BrandIcon size={20} className="shrink-0" />;
  if (ECOSYSTEM_PLATFORMS.has(platform)) return <Globe className="h-5 w-5" />;
  return <LinkIcon className="h-5 w-5" />;
}

function isValidUrl(url: string) {
  try {
    if (!url || url.length < 5) return false;
    const lower = url.toLowerCase();
    if (lower.includes('example.com') || lower === 'http://' || lower === 'https://' || lower === 'na' || lower === 'none') {
      return false;
    }
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function SocialIconsLarge({ metadata, references: propReferences }: SocialIconsLargeProps) {
  const references = propReferences || (metadata?.references as Array<{ label: string; uri: string }> | undefined) || [];
  
  if (references.length === 0) return null;

  const validRefs = references.filter(ref => isValidUrl(ref.uri));
  if (validRefs.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {validRefs.slice(0, 6).map((ref, i) => {
        const platform = extractSocialPlatform(ref.uri, ref.label);
        return (
          <TooltipProvider key={i}>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={ref.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg border bg-muted/30 text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  {getIcon(platform)}
                </a>
              </TooltipTrigger>
              <TooltipContent>
                <p>{platform}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}
