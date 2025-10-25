import * as React from "react"

import * as DialogPrimitive from "@radix-ui/react-dialog"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-100 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-right-1/2 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-right-1/2",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[500px] translate-x-[-50%] translate-y-[-50%] rounded-md border bg-card p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-100 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-right-1/2 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-right-1/2 focus:outline-none",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close asChild>
        <Button
          variant="ghost"
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 data-[state=open]:bg-accent data-[state=state=open]:text-muted-foreground"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span className="sr-only">Close</span>
        </Button>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitiveHeader>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitiveFooter>) => (
  <div className={cn("flex flex-col sm:flex-row sm:justify-end sm:space-x-2 space-y-2 sm:space-y-0", className)} {...props} />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitiveTitle>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitiveTitle>
>(({ className, ...props }, ref) => (
  <DialogPrimitiveTitle ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight text-foreground", className)} {...props} />
))
DialogTitle.displayName = DialogPrimitiveTitle.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitiveDescription>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitiveDescription>
>(({ className, ...props }, ref) => (
  <DialogPrimitiveDescription ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
))
DialogDescription.displayName = DialogPrimitiveDescription.displayName

const DialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitiveCancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitiveCancel>
>(({ className, ...props }, ref) => (
  <Button
    variant="secondary"
    className={cn(
      "mt-2 sm:mt-0",
      className
    )}
    ref={ref}
    {...props}
  />
))
DialogCancel.displayName = AlertDialogPrimitiveCancel.displayName

const DialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitiveAction>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitiveAction>
>(({ className, ...props }, ref) => (
  <Button
    className={cn(
      "mt-2 sm:mt-0",
      className
    )}
    ref={ref}
    {...props}
  />
))
DialogAction.displayName = AlertDialogPrimitiveAction.displayName

export {
  Dialog,
  DialogPortal,
  DialogTrigger,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogCancel,
  DialogAction,
}