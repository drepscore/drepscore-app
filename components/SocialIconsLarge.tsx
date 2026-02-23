'use client';

/**
 * Social Icons Large Component
 * Larger social media icons for the DRep detail page
 */

import { extractSocialPlatform } from '@/utils/display';
import {
  Twitter,
  Github,
  Globe,
  Linkedin,
  Facebook,
  Instagram,
  Youtube,
  MessageCircle,
  Link as LinkIcon,
} from 'lucide-react';
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

export function SocialIconsLarge({ metadata, references: propReferences }: SocialIconsLargeProps) {
  const references = propReferences || (metadata?.references as Array<{ label: string; uri: string }> | undefined) || [];
  
  if (references.length === 0) return null;

  const getIcon = (platform: string) => {
    const iconClass = "h-5 w-5";
    switch (platform) {
      case 'Twitter/X': return <Twitter className={iconClass} />;
      case 'GitHub': return <Github className={iconClass} />;
      case 'LinkedIn': return <Linkedin className={iconClass} />;
      case 'Facebook': return <Facebook className={iconClass} />;
      case 'Instagram': return <Instagram className={iconClass} />;
      case 'YouTube': return <Youtube className={iconClass} />;
      case 'Discord': return <MessageCircle className={iconClass} />;
      case 'Telegram': return <MessageCircle className={iconClass} />;
      case 'Cardano Foundation': return <Globe className={iconClass} />;
      case 'IOHK': return <Globe className={iconClass} />;
      case 'EMURGO': return <Globe className={iconClass} />;
      default: return <LinkIcon className={iconClass} />;
    }
  };

  const isValidUrl = (url: string) => {
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
  };

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
