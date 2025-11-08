import { useEffect, useRef, useState } from 'react';
import DRepList from '@/components/features/DRepList';
import { DRepsSummaryStats } from '@/components/features/DRepsSummaryStats';
import { SheepFlock } from '@/components/animations/SheepFlock';
import { SheepIcon } from '@/components/ui/SheepIcon';
import type { DRep, DRepMetadata, JsonValue } from '@/types/governance';
