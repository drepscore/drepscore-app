'use client';

/**
 * Social Icons Component
 * Displays social media icons for a DRep
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
  MessageCircle, // For Discord/Telegram/etc
  Mail,
  Link as LinkIcon,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SocialIconsProps {
  metadata: Record<string, unknown> | null;
}

export function SocialIcons({ metadata }: SocialIconsProps) {
  if (!metadata) return null;

  // Extract references (links) from metadata
  const references = (metadata.references as Array<{ label: string; uri: string }> | undefined) || [];
  
  // Also check for direct email
  const email = metadata.email as string | undefined;

  if (references.length === 0 && !email) return null;

  // Helper to get icon for platform
  const getIcon = (platform: string) => {
    switch (platform) {
      case 'Twitter/X': return <Twitter className="h-3.5 w-3.5" />;
      case 'GitHub': return <Github className="h-3.5 w-3.5" />;
      case 'LinkedIn': return <Linkedin className="h-3.5 w-3.5" />;
      case 'Facebook': return <Facebook className="h-3.5 w-3.5" />;
      case 'Instagram': return <Instagram className="h-3.5 w-3.5" />;
      case 'YouTube': return <Youtube className="h-3.5 w-3.5" />;
      case 'Discord': return <MessageCircle className="h-3.5 w-3.5" />;
      case 'Telegram': return <MessageCircle className="h-3.5 w-3.5" />;
      case 'Cardano Foundation': return <Globe className="h-3.5 w-3.5" />;
      case 'IOHK': return <Globe className="h-3.5 w-3.5" />;
      case 'EMURGO': return <Globe className="h-3.5 w-3.5" />;
      default: return <LinkIcon className="h-3.5 w-3.5" />;
    }
  };

  // Helper to validate URL
  const isValidUrl = (url: string) => {
    try {
      if (!url || url.length < 5) return false;
      const lower = url.toLowerCase();
      // Filter out obvious placeholders
      if (lower.includes('example.com') || lower === 'http://' || lower === 'https://' || lower === 'na' || lower === 'none') {
        return false;
      }
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="flex items-center gap-1 mt-1 flex-wrap">
      {references.slice(0, 4).map((ref, i) => { // Limit to 4 to prevent clutter
        if (!isValidUrl(ref.uri)) return null;

        const platform = extractSocialPlatform(ref.uri, ref.label);
        return (
          <TooltipProvider key={i}>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={ref.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors p-0.5"
                  onClick={(e) => e.stopPropagation()} // Prevent row click
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
      
      {email && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={`mailto:${email}`}
                className="text-muted-foreground hover:text-primary transition-colors p-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <Mail className="h-3.5 w-3.5" />
              </a>
            </TooltipTrigger>
            <TooltipContent>
              <p>Email</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
