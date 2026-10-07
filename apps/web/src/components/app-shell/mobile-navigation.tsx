'use client';

import {
  useState,
} from 'react';

import {
  Menu,
} from 'lucide-react';

import {
  Button,
} from '@/components/ui/button';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

import {
  AppNavigation,
} from './app-navigation';

export function MobileNavigation({
  organizationId,
}: {
  organizationId:
    string | undefined;
}) {
  const [
    open,
    setOpen,
  ] =
    useState(
      false,
    );

  return (
    <Sheet
      open={
        open
      }
      onOpenChange={
        setOpen
      }
    >
      <SheetTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label="Open navigation"
            className="lg:hidden"
          />
        }
      >
        <Menu
          className="size-4"
        />
      </SheetTrigger>

      <SheetContent
        side="left"
        className="w-72 p-0"
      >
        <SheetHeader
          className="border-b p-5"
        >
          <SheetTitle>
            OpsDesk
          </SheetTitle>
        </SheetHeader>

        <div
          className="p-3"
        >
          <AppNavigation
            organizationId={
              organizationId
            }
            onNavigate={
              () =>
                setOpen(
                  false,
                )
            }
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}