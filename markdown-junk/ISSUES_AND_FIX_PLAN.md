# Issues Found and Fix Plan

## Issues Identified

### 1. **TypeScript Build Error** ❌
- **Location**: `components/VotingPowerChart.tsx:26`
- **Issue**: Type error - `'percent' is of type 'unknown'` in the Recharts label function
- **Impact**: Build fails, preventing production deployment
- **Severity**: Critical

### 2. **Inconsistent Design System Usage** ⚠️
- **Location**: Multiple components and pages
- **Issue**: Widespread use of hardcoded Tailwind gray colors (`text-gray-*`, `border-gray-*`, `bg-gray-*`) instead of design system tokens (`text-muted-foreground`, `border-input`, `bg-background`, etc.)
- **Impact**: 
  - Dark mode won't work properly
  - Inconsistent styling across the app
  - Harder to maintain theme changes
- **Files Affected**:
  - `components/DelegateForm.tsx` (8 instances)
  - `components/RegisterDRepForm.tsx` (7 instances)
  - `components/DRepDetail.tsx` (12 instances)
  - `components/ActionDetail.tsx` (11 instances)
  - `components/ActionTimeline.tsx` (3 instances)
  - `components/TransactionModal.tsx` (4 instances)
  - `components/WalletConnect.tsx` (8 instances)
  - `components/VotingPowerChart.tsx` (1 instance)
  - `components/VotingPowerFlow.tsx` (1 instance)
  - `components/VotingChart.tsx` (1 instance)
  - `components/GovernanceHeatmap.tsx` (2 instances)
  - `components/ui/Timeline.tsx` (1 instance)
  - `components/ui/Modal.tsx` (1 instance)
  - `app/delegate/page.tsx` (1 instance)
- **Severity**: High

### 3. **Hardcoded White Backgrounds** ⚠️
- **Location**: `components/WalletConnect.tsx`, `components/ui/Modal.tsx`
- **Issue**: Using `bg-white` instead of `bg-background` or `bg-card`
- **Impact**: Won't adapt to dark mode
- **Severity**: Medium

### 4. **Inconsistent Typography** ⚠️
- **Location**: `app/actions/page.tsx`
- **Issue**: Page title doesn't use `font-display` like other pages
- **Impact**: Inconsistent visual hierarchy
- **Severity**: Low

### 5. **Missing Dark Mode Support in Charts** ⚠️
- **Location**: Chart components (`VotingPowerChart`, `VotingChart`, `GovernanceHeatmap`)
- **Issue**: Empty state messages use hardcoded `text-gray-500`
- **Impact**: Charts won't look good in dark mode
- **Severity**: Medium

## Fix Plan

### Phase 1: Critical Fixes (Must Fix)
1. **Fix TypeScript Error in VotingPowerChart**
   - Add proper type annotation for the Recharts label function
   - Use type assertion or typed callback

### Phase 2: Design System Consistency (High Priority)
2. **Replace Hardcoded Gray Colors**
   - Replace all `text-gray-*` with appropriate design tokens:
     - `text-gray-500` → `text-muted-foreground`
     - `text-gray-600` → `text-muted-foreground` or `text-foreground` (depending on context)
     - `text-gray-700` → `text-foreground`
     - `text-gray-900` → `text-foreground`
   - Replace all `border-gray-*` with:
     - `border-gray-200` → `border-input` or `border`
     - `border-gray-300` → `border-input`
   - Replace all `bg-gray-*` with:
     - `bg-gray-50` → `bg-muted/50` or `bg-muted`
     - `bg-gray-100` → `bg-muted`
     - `bg-gray-200` → `bg-muted` or `bg-secondary`
   
3. **Replace Hardcoded White Backgrounds**
   - `bg-white` → `bg-background` or `bg-card` (depending on context)

4. **Fix Chart Components**
   - Update empty state messages in chart components to use design tokens
   - Ensure charts support dark mode

### Phase 3: Consistency Improvements (Medium Priority)
5. **Standardize Typography**
   - Update `app/actions/page.tsx` to use `font-display` for consistency
   - Ensure all page titles use consistent styling

6. **Update Form Components**
   - Ensure all form inputs use design system tokens
   - Update labels and helper text to use appropriate tokens

### Phase 4: Testing & Verification (Final)
7. **Visual Testing**
   - Test all pages in both light and dark mode
   - Verify color consistency across all components
   - Check that all interactive elements have proper hover/focus states

8. **Build Verification**
   - Run `npm run build` to ensure no TypeScript errors
   - Verify all pages compile correctly

## Implementation Order

1. ✅ Fix TypeScript error (Critical - blocks build)
2. ✅ Replace hardcoded colors in core UI components (Modal, WalletConnect)
3. ✅ Update form components (DelegateForm, RegisterDRepForm)
4. ✅ Update detail pages (DRepDetail, ActionDetail)
5. ✅ Update chart components
6. ✅ Update timeline and list components
7. ✅ Fix page-level inconsistencies
8. ✅ Final verification and testing

## Files to Modify

### Critical (1 file):
- `components/VotingPowerChart.tsx`

### High Priority (15 files):
- `components/DelegateForm.tsx`
- `components/RegisterDRepForm.tsx`
- `components/DRepDetail.tsx`
- `components/ActionDetail.tsx`
- `components/ActionTimeline.tsx`
- `components/TransactionModal.tsx`
- `components/WalletConnect.tsx`
- `components/VotingPowerChart.tsx`
- `components/VotingPowerFlow.tsx`
- `components/VotingChart.tsx`
- `components/GovernanceHeatmap.tsx`
- `components/ui/Timeline.tsx`
- `components/ui/Modal.tsx`
- `app/delegate/page.tsx`
- `app/actions/page.tsx`

## Color Mapping Reference

| Old Color | New Token | Usage Context |
|-----------|-----------|---------------|
| `text-gray-500` | `text-muted-foreground` | Secondary text, labels, helper text |
| `text-gray-600` | `text-muted-foreground` | Less prominent text |
| `text-gray-700` | `text-foreground` | Body text |
| `text-gray-900` | `text-foreground` | Headings, primary text |
| `border-gray-200` | `border-input` or `border` | Input borders |
| `border-gray-300` | `border-input` | Input borders (darker) |
| `bg-gray-50` | `bg-muted/50` | Subtle backgrounds |
| `bg-gray-100` | `bg-muted` | Card backgrounds, code blocks |
| `bg-gray-200` | `bg-muted` or `bg-secondary` | Progress bars, dividers |
| `bg-white` | `bg-background` or `bg-card` | Main backgrounds, cards |
| `text-white` | `text-primary-foreground` or `text-white` | Text on colored backgrounds (keep if needed) |

