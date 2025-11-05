import { ReactNode } from 'react';

interface TimelineProps {
  children: ReactNode;
}

export function Timeline({ children }: TimelineProps) {
  return <div className="relative">{children}</div>;
}

interface TimelineEventProps {
  children: ReactNode;
  date?: string;
}

export function TimelineEvent({ children, date }: TimelineEventProps) {
  return (
    <div className="flex items-start space-x-4 mb-4">
      <div className="flex-shrink-0 w-4 h-4 rounded-full bg-field-green mt-2"></div>
      <div className="flex-1">{children}</div>
      {date && <div className="text-sm text-muted-foreground">{date}</div>}
    </div>
  );
}

