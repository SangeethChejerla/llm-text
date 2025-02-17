"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/use-media-query"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"

interface BaseProps {
  children: React.ReactNode
}

interface RootResponsiveModalProps extends BaseProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

interface ResponsiveModalProps extends BaseProps {
  className?: string
  asChild?: true
}

const ResponsiveModalContext = React.createContext<{ isDesktop: boolean }>({
  isDesktop: false,
});

const useResponsiveModalContext = () => {
  const context = React.useContext(ResponsiveModalContext);
  if (!context) {
    throw new Error(
      "ResponsiveModal components cannot be rendered outside the ResponsiveModal Context",
    );
  }
  return context;
};

const ResponsiveModal = ({ children, ...props }: RootResponsiveModalProps) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const ModalComponent = isDesktop ? Dialog : Drawer;

  return (
    <ResponsiveModalContext.Provider value={{ isDesktop }}>
      <ModalComponent {...props} {...(!isDesktop && { autoFocus: true })}>
        {children}
      </ModalComponent>
    </ResponsiveModalContext.Provider>
  );
};


const ResponsiveModalTrigger = ({ className, children, ...props }: ResponsiveModalProps) => {
  const { isDesktop } = useResponsiveModalContext();
  const TriggerComponent = isDesktop ? DialogTrigger : DrawerTrigger;

  return (
    <TriggerComponent className={className} {...props}>
      {children}
    </TriggerComponent>
  );
};

const ResponsiveModalClose = ({ className, children, ...props }: ResponsiveModalProps) => {
  const { isDesktop } = useResponsiveModalContext();
  const CloseComponent = isDesktop ? DialogClose : DrawerClose;

  return (
    <CloseComponent className={className} {...props}>
      {children}
    </CloseComponent>
  );
};

const ResponsiveModalContent = ({ className, children, ...props }: ResponsiveModalProps) => {
  const { isDesktop } = useResponsiveModalContext();
  const ContentComponent = isDesktop ? DialogContent : DrawerContent;

  return (
    <ContentComponent className={className} {...props}>
      {children}
    </ContentComponent>
  );
};

const ResponsiveModalDescription = ({
  className,
  children,
  ...props
}: ResponsiveModalProps) => {
  const { isDesktop } = useResponsiveModalContext();
  const DescriptionComponent = isDesktop ? DialogDescription : DrawerDescription;

  return (
    <DescriptionComponent className={className} {...props}>
      {children}
    </DescriptionComponent>
  );
};

const ResponsiveModalHeader = ({ className, children, ...props }: ResponsiveModalProps) => {
  const { isDesktop } = useResponsiveModalContext();
  const HeaderComponent = isDesktop ? DialogHeader : DrawerHeader;

  return (
    <HeaderComponent className={className} {...props}>
      {children}
    </HeaderComponent>
  );
};

const ResponsiveModalTitle = ({ className, children, ...props }: ResponsiveModalProps) => {
  const { isDesktop } = useResponsiveModalContext();
  const TitleComponent = isDesktop ? DialogTitle : DrawerTitle;

  return (
    <TitleComponent className={className} {...props}>
      {children}
    </TitleComponent>
  );
};

const ResponsiveModalBody = ({ className, children, ...props }: ResponsiveModalProps) => {
  return (
    <div className={cn("px-4 md:px-0", className)} {...props}>
      {children}
    </div>
  );
};

const ResponsiveModalFooter = ({ className, children, ...props }: ResponsiveModalProps) => {
  const { isDesktop } = useResponsiveModalContext();
  const FooterComponent = isDesktop ? DialogFooter : DrawerFooter;

  return (
    <FooterComponent className={className} {...props}>
      {children}
    </FooterComponent>
  );
};

export {
  ResponsiveModal,
  ResponsiveModalTrigger,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalBody,
  ResponsiveModalFooter,
}