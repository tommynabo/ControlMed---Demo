import React from 'react';
import { Wallet } from 'lucide-react';

interface BalanceBadgeProps {
    balance: number;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export const BalanceBadge: React.FC<BalanceBadgeProps> = ({
    balance,
    size = 'md',
    className = ''
}) => {
    if (balance <= 0) return null;

    const sizeClasses = {
        sm: 'px-2 py-1 text-[10px]',
        md: 'px-3 py-2 text-xs',
        lg: 'px-4 py-3 text-sm'
    };

    return (
        <div className={`inline-flex items-center gap-2 bg-green-100 text-green-800 rounded-lg font-bold ${sizeClasses[size]} ${className}`}>
            <Wallet size={size === 'sm' ? 12 : size === 'md' ? 14 : 16} className="text-green-600" />
            <span>Saldo a favor: {balance.toFixed(2)}€</span>
        </div>
    );
};
