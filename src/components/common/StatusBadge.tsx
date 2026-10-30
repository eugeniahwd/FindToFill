'use client';

import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wrench,
  HelpCircle,
  LucideIcon,
} from 'lucide-react';
import { EffectiveStatus } from '@/lib/types';
import { getStatusBadgeInfo } from '@/lib/utils/status';

interface StatusBadgeProps {
  status: EffectiveStatus;
  size?: 'sm' | 'md';
  className?: string;
}

const STATUS_ICONS: Record<EffectiveStatus, LucideIcon> = {
  available: CheckCircle2,
  empty: AlertTriangle,
  broken: XCircle,
  under_maintenance: Wrench,
  unknown: HelpCircle,
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  className = '',
}) => {
  const info = getStatusBadgeInfo(status);
  const Icon = STATUS_ICONS[status] || HelpCircle;

  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-xs gap-1'
      : 'px-2.5 py-1 text-xs sm:text-sm gap-1.5 font-medium';

  const iconSizes = size === 'sm' ? 12 : 15;

  return (
    <span
      role="status"
      aria-label={`Status: ${info.label}`}
      className={`inline-flex items-center rounded-full border ${info.bgClass} ${info.textClass} ${info.borderClass} ${sizeClasses} ${className}`}
    >
      <Icon
        size={iconSizes}
        className="shrink-0"
        strokeWidth={2.2}
        aria-hidden="true"
      />
      <span>{info.label}</span>
    </span>
  );
};
