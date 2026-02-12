"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AppShellNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
};

type AppShellV0Props = {
  children: React.ReactNode;
  navItems: AppShellNavItem[];
  activeId?: string;
};

export function AppShellV0({ children, navItems, activeId }: AppShellV0Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop Navigation */}
      <div className="fixed top-4 right-4 z-50 hidden lg:flex gap-1 p-1 bg-card/90 backdrop-blur-md rounded-xl border border-border shadow-lg">
        {navItems.map((item) => {
          const active = activeId === item.id;
          const commonClass = cn(
            "text-xs gap-1.5",
            item.disabled && "opacity-50 cursor-not-allowed"
          );

          if (item.href && !item.disabled) {
            return (
              <Button
                key={item.id}
                variant={active ? "default" : "ghost"}
                size="sm"
                className={commonClass}
                asChild
              >
                <Link
                  href={item.href}
                  onClick={item.onClick}
                  aria-current={active ? "page" : undefined}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
              </Button>
            );
          }

          return (
            <Button
              key={item.id}
              variant={active ? "default" : "ghost"}
              size="sm"
              className={commonClass}
              onClick={item.disabled ? undefined : item.onClick}
              disabled={item.disabled}
              title={item.title}
            >
              <item.icon className="w-3.5 h-3.5" />
              {item.label}
            </Button>
          );
        })}
      </div>

      {/* Mobile Navigation Toggle */}
      <Button
        variant="outline"
        size="icon"
        className="fixed top-4 right-4 z-50 lg:hidden bg-card/90 backdrop-blur-md"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
      >
        {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute top-16 right-4 bg-card border border-border rounded-xl p-2 shadow-xl">
            {navItems.map((item) => {
              const active = activeId === item.id;
              const commonClass = cn(
                "w-full justify-start gap-2 mb-1",
                item.disabled && "opacity-50 cursor-not-allowed"
              );

              if (item.href && !item.disabled) {
                return (
                  <Button
                    key={item.id}
                    variant={active ? "default" : "ghost"}
                    size="sm"
                    className={commonClass}
                    asChild
                  >
                    <Link
                      href={item.href}
                      onClick={() => {
                        item.onClick?.();
                        setMobileMenuOpen(false);
                      }}
                      aria-current={active ? "page" : undefined}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  </Button>
                );
              }

              return (
                <Button
                  key={item.id}
                  variant={active ? "default" : "ghost"}
                  size="sm"
                  className={commonClass}
                  onClick={() => {
                    if (item.disabled) return;
                    item.onClick?.();
                    setMobileMenuOpen(false);
                  }}
                  disabled={item.disabled}
                  title={item.title}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
