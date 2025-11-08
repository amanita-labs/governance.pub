import { useState, useEffect } from 'react';
import ActionList from '@/components/features/ActionList';
import { Badge } from '@/components/ui/Badge';
import { Loader2 } from 'lucide-react';
import type { GovernanceAction } from '@/types/governance';
import { SheepIcon } from '@/components/ui/SheepIcon';
import { SheepAnimation } from '@/components/animations/SheepAnimation';
