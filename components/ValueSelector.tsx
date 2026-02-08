'use client';

/**
 * Value Selector Component
 * Multi-select dropdown for value preferences
 */

import { useState } from 'react';
import { ValuePreference } from '@/types/drep';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, X } from 'lucide-react';

const VALUE_OPTIONS: ValuePreference[] = [
  'Treasury Conservative',
  'Pro-DeFi',
  'High Participation',
  'Pro-Privacy',
  'Pro-Decentralization',
  'Active Rationale Provider',
];

interface ValueSelectorProps {
  selectedValues: ValuePreference[];
  onValuesChange: (values: ValuePreference[]) => void;
  onSearch?: () => void;
}

export function ValueSelector({ selectedValues, onValuesChange, onSearch }: ValueSelectorProps) {
  const [open, setOpen] = useState(false);

  const toggleValue = (value: ValuePreference) => {
    if (selectedValues.includes(value)) {
      onValuesChange(selectedValues.filter(v => v !== value));
    } else {
      if (selectedValues.length < 5) {
        onValuesChange([...selectedValues, value]);
      }
    }
  };

  const removeValue = (value: ValuePreference) => {
    onValuesChange(selectedValues.filter(v => v !== value));
  };

  const clearAll = () => {
    onValuesChange([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              Select Your Values
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64">
            <DropdownMenuLabel>
              Choose up to 5 values
              {selectedValues.length > 0 && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({selectedValues.length}/5)
                </span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {VALUE_OPTIONS.map((value) => (
              <DropdownMenuCheckboxItem
                key={value}
                checked={selectedValues.includes(value)}
                onCheckedChange={() => toggleValue(value)}
                disabled={!selectedValues.includes(value) && selectedValues.length >= 5}
              >
                {value}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {selectedValues.length > 0 && (
          <>
            <Button
              variant="default"
              onClick={onSearch}
              className="gap-2"
            >
              Find Matching DReps
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="gap-1 text-muted-foreground"
            >
              Clear All
            </Button>
          </>
        )}
      </div>

      {selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedValues.map((value) => (
            <Badge key={value} variant="secondary" className="gap-1 pr-1">
              {value}
              <button
                onClick={() => removeValue(value)}
                className="ml-1 hover:bg-muted rounded-sm p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
