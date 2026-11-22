import React, { useState, useEffect } from 'react';
import { ShoppingBag } from 'lucide-react';
import {
  getStoredCart,
  calculateCartCount,
  openCartDrawer,
  CART_UPDATED_EVENT,
} from '../lib/cart';

export interface HeaderBagButtonProps {
  className?: string;
  onClick?: () => void;
}

export function HeaderBagButton({ className = '', onClick }: HeaderBagButtonProps) {
  const [cartCount, setCartCount] = useState<number>(() => calculateCartCount(getStoredCart()));

  useEffect(() => {
    const handleCartUpdate = (e: any) => {
      if (e?.detail?.count !== undefined && typeof e.detail.count === 'number') {
        setCartCount(e.detail.count);
      } else {
        setCartCount(calculateCartCount(getStoredCart()));
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(CART_UPDATED_EVENT, handleCartUpdate);
      return () => window.removeEventListener(CART_UPDATED_EVENT, handleCartUpdate);
    }
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onClick) {
      onClick();
    } else {
      openCartDrawer();
    }
  };

  const isFilled = cartCount > 0;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={
        isFilled
          ? `Shopping Bag with ${cartCount} ${cartCount === 1 ? 'item' : 'items'}`
          : 'Shopping Bag (empty)'
      }
      className={`group relative inline-flex items-center justify-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-300 isolate outline-none focus:outline-none cursor-pointer active:scale-95 select-none ${
        isFilled
          ? 'shadow-md hover:brightness-110 active:scale-95'
          : 'hover:bg-[var(--theme-surface-subtle)] hover:border-[var(--theme-border-strong)] shadow-2xs'
      } ${className}`}
      style={
        isFilled
          ? {
              backgroundColor: 'var(--theme-accent, var(--theme-primary))',
              color: 'var(--theme-on-primary)',
              borderColor: 'color-mix(in srgb, var(--theme-on-primary) 30%, transparent)',
              borderWidth: '1px',
              borderStyle: 'solid',
              boxShadow:
                '0 4px 18px color-mix(in srgb, var(--theme-accent, var(--theme-primary)) 40%, transparent)',
            }
          : {
              backgroundColor: 'var(--theme-surface)',
              color: 'var(--theme-text)',
              borderColor: 'var(--theme-border)',
              borderWidth: '1px',
              borderStyle: 'solid',
            }
      }
    >
      {/* Icon with motion-safe active accent ping when filled */}
      <span className="relative flex items-center justify-center">
        <ShoppingBag
          className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-105"
          style={{
            color: isFilled
              ? 'var(--theme-on-primary)'
              : 'var(--theme-text-muted)',
          }}
        />
        {isFilled && (
          <span className="absolute -top-1 -right-1 flex h-2 w-2">
            <span
              className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--theme-on-primary) 90%, transparent)',
              }}
            />
            <span
              className="relative inline-flex rounded-full h-2 w-2"
              style={{
                backgroundColor: 'var(--theme-on-primary)',
              }}
            />
          </span>
        )}
      </span>

      <span className="font-medium tracking-tight">Bag</span>

      {/* Distinct Badge: Calm surface on 0, vivid accent on 1+ */}
      <span
        className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-mono font-bold tabular-nums min-w-[20px] transition-colors"
        style={
          isFilled
            ? {
                backgroundColor:
                  'color-mix(in srgb, var(--theme-on-primary) 22%, transparent)',
                color: 'var(--theme-on-primary)',
              }
            : {
                backgroundColor: 'var(--theme-surface-subtle)',
                color: 'var(--theme-text-muted)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'var(--theme-border)',
              }
        }
      >
        {cartCount}
      </span>
    </button>
  );
}
