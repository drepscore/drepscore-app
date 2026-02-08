'use client';

/**
 * DRep Table Component
 * Main table for displaying and filtering DReps
 */

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { DRep, DRepWithScore, DRepFilters, DRepSort, ValuePreference } from '@/types/drep';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowUpDown, Search, ExternalLink } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { formatAda, getParticipationColor, getRationaleColor, shortenDRepId } from '@/utils/scoring';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ParticipationRateModal, DecentralizationScoreModal, RationaleImportanceModal } from './InfoModal';

interface DRepTableProps {
  dreps: (DRep | DRepWithScore)[];
  showMatchScore?: boolean;
}

export function DRepTable({ dreps, showMatchScore = false }: DRepTableProps) {
  const [filters, setFilters] = useState<DRepFilters>({
    search: '',
    minParticipation: 0,
    minVotingPower: 0,
    selectedValues: [],
    showActiveOnly: true,
  });
  
  const [sort, setSort] = useState<DRepSort>({
    field: showMatchScore ? 'matchScore' : 'votingPower',
    direction: 'desc',
  });
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Filter and sort DReps
  const filteredAndSortedDReps = useMemo(() => {
    let result = [...dreps];

    // Apply filters
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(drep =>
        drep.drepId.toLowerCase().includes(searchLower) ||
        drep.handle?.toLowerCase().includes(searchLower)
      );
    }

    if (filters.minParticipation > 0) {
      result = result.filter(drep => drep.participationRate >= filters.minParticipation);
    }

    if (filters.minVotingPower > 0) {
      result = result.filter(drep => drep.votingPower >= filters.minVotingPower);
    }

    if (filters.showActiveOnly) {
      result = result.filter(drep => drep.isActive);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sort.field) {
        case 'drepId':
          aVal = a.drepId;
          bVal = b.drepId;
          break;
        case 'votingPower':
          aVal = a.votingPower;
          bVal = b.votingPower;
          break;
        case 'participationRate':
          aVal = a.participationRate;
          bVal = b.participationRate;
          break;
        case 'rationaleRate':
          aVal = a.rationaleRate;
          bVal = b.rationaleRate;
          break;
        case 'decentralizationScore':
          aVal = a.decentralizationScore;
          bVal = b.decentralizationScore;
          break;
        case 'matchScore':
          aVal = 'matchScore' in a ? a.matchScore : 0;
          bVal = 'matchScore' in b ? b.matchScore : 0;
          break;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sort.direction === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      // Type narrowing: both should be numbers at this point
      const aNum = typeof aVal === 'number' ? aVal : 0;
      const bNum = typeof bVal === 'number' ? bVal : 0;
      return sort.direction === 'asc' ? aNum - bNum : bNum - aNum;
    });

    return result;
  }, [dreps, filters, sort, showMatchScore]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedDReps.length / pageSize);
  const paginatedDReps = filteredAndSortedDReps.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const toggleSort = (field: DRepSort['field']) => {
    setSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      minParticipation: 0,
      minVotingPower: 0,
      selectedValues: [],
      showActiveOnly: true,
    });
    setCurrentPage(1);
  };

  if (paginatedDReps.length === 0 && filteredAndSortedDReps.length === 0) {
    return (
      <EmptyState
        title="No DReps Found"
        message="Try adjusting your filters or check back later for updated data"
        action={{
          label: 'Reset Filters',
          onClick: resetFilters,
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by DRep ID or handle..."
            value={filters.search}
            onChange={(e) => {
              setFilters({ ...filters, search: e.target.value });
              setCurrentPage(1);
            }}
            className="pl-10"
          />
        </div>
        <Select
          value={filters.minParticipation.toString()}
          onValueChange={(val) => {
            setFilters({ ...filters, minParticipation: parseInt(val) });
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Min Participation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">All Participation</SelectItem>
            <SelectItem value="40">40%+ Participation</SelectItem>
            <SelectItem value="70">70%+ Participation</SelectItem>
            <SelectItem value="90">90%+ Participation</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {paginatedDReps.length} of {filteredAndSortedDReps.length} DReps
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  onClick={() => toggleSort('drepId')}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  DRep ID / Handle
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => toggleSort('votingPower')}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Voting Power
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleSort('participationRate')}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    Participation
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                  <ParticipationRateModal />
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleSort('decentralizationScore')}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    Decentralization
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                  <DecentralizationScoreModal />
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleSort('rationaleRate')}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    Rationale Rate
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                  <RationaleImportanceModal />
                </div>
              </TableHead>
              {showMatchScore && (
                <TableHead>
                  <button
                    onClick={() => toggleSort('matchScore')}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    Match Score
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
              )}
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedDReps.map((drep) => (
              <TableRow key={drep.drepId}>
                <TableCell>
                  <Link
                    href={`/drep/${encodeURIComponent(drep.drepId)}`}
                    className="flex items-center gap-2 hover:text-primary group"
                  >
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-mono text-sm">
                            {drep.handle || shortenDRepId(drep.drepId)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-mono text-xs">{drep.drepId}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </TableCell>
                <TableCell className="font-medium">
                  {formatAda(drep.votingPower)} ADA
                </TableCell>
                <TableCell>
                  <span className={getParticipationColor(drep.participationRate)}>
                    {drep.participationRate}%
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm">
                    {drep.decentralizationScore}/100
                  </span>
                </TableCell>
                <TableCell>
                  <span className={getRationaleColor(drep.rationaleRate)}>
                    {drep.rationaleRate}%
                  </span>
                </TableCell>
                {showMatchScore && 'matchScore' in drep && (
                  <TableCell>
                    <Badge variant="default">{drep.matchScore}%</Badge>
                  </TableCell>
                )}
                <TableCell>
                  <Badge variant={drep.isActive ? 'default' : 'secondary'}>
                    {drep.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page:</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(val) => {
                setPageSize(parseInt(val));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
