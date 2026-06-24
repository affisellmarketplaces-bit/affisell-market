import {
  RouteModalForm,
  RouteModalProvider,
  StackedModalProvider,
  useStackedModal,
  useStateAwareTo
} from "./chunk-ULMMKZ3U.mjs";

// src/components/modals/route-drawer/route-drawer.tsx
import { Drawer, clx } from "@medusajs/ui";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jsx } from "react/jsx-runtime";
var Root = ({ prev = "..", children }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [stackedModalOpen, onStackedModalOpen] = useState(false);
  const to = useStateAwareTo(prev);
  useEffect(() => {
    setOpen(true);
    return () => {
      setOpen(false);
      onStackedModalOpen(false);
    };
  }, []);
  const handleOpenChange = (open2) => {
    if (!open2) {
      document.body.style.pointerEvents = "auto";
      navigate(to, { replace: true });
      return;
    }
    setOpen(open2);
  };
  return /* @__PURE__ */ jsx(Drawer, { open, onOpenChange: handleOpenChange, children: /* @__PURE__ */ jsx(RouteModalProvider, { prev: to, children: /* @__PURE__ */ jsx(StackedModalProvider, { onOpenChange: onStackedModalOpen, children: /* @__PURE__ */ jsx(
    Drawer.Content,
    {
      "aria-describedby": void 0,
      className: clx({
        "!bg-ui-bg-disabled !inset-y-5 !right-5": stackedModalOpen
      }),
      children
    }
  ) }) }) });
};
var Header = Drawer.Header;
var Title = Drawer.Title;
var Description = Drawer.Description;
var Body = Drawer.Body;
var Footer = Drawer.Footer;
var Close = Drawer.Close;
var Form = RouteModalForm;
var RouteDrawer = Object.assign(Root, {
  Header,
  Title,
  Body,
  Description,
  Footer,
  Close,
  Form
});

// src/components/modals/stacked-drawer/stacked-drawer.tsx
import { Drawer as Drawer2, clx as clx2 } from "@medusajs/ui";
import {
  forwardRef,
  useEffect as useEffect2
} from "react";
import { jsx as jsx2 } from "react/jsx-runtime";
var Root2 = ({ id, children }) => {
  const { register, unregister, getIsOpen, setIsOpen } = useStackedModal();
  useEffect2(() => {
    register(id);
    return () => unregister(id);
  }, []);
  return /* @__PURE__ */ jsx2(Drawer2, { open: getIsOpen(id), onOpenChange: (open) => setIsOpen(id, open), children });
};
var Close2 = Drawer2.Close;
Close2.displayName = "StackedDrawer.Close";
var Header2 = Drawer2.Header;
Header2.displayName = "StackedDrawer.Header";
var Body2 = Drawer2.Body;
Body2.displayName = "StackedDrawer.Body";
var Trigger = Drawer2.Trigger;
Trigger.displayName = "StackedDrawer.Trigger";
var Footer2 = Drawer2.Footer;
Footer2.displayName = "StackedDrawer.Footer";
var Title2 = Drawer2.Title;
Title2.displayName = "StackedDrawer.Title";
var Description2 = Drawer2.Description;
Description2.displayName = "StackedDrawer.Description";
var Content = forwardRef(({ className, ...props }, ref) => {
  return /* @__PURE__ */ jsx2(
    Drawer2.Content,
    {
      ref,
      className: clx2(className),
      overlayProps: {
        className: "bg-transparent"
      },
      ...props
    }
  );
});
Content.displayName = "StackedDrawer.Content";
var StackedDrawer = Object.assign(Root2, {
  Close: Close2,
  Header: Header2,
  Body: Body2,
  Content,
  Trigger,
  Footer: Footer2,
  Description: Description2,
  Title: Title2
});

// src/components/modals/stacked-focus-modal/stacked-focus-modal.tsx
import { FocusModal, clx as clx3 } from "@medusajs/ui";
import {
  forwardRef as forwardRef2,
  useEffect as useEffect3
} from "react";
import { jsx as jsx3 } from "react/jsx-runtime";
var Root3 = ({
  id,
  onOpenChangeCallback,
  children
}) => {
  const { register, unregister, getIsOpen, setIsOpen } = useStackedModal();
  useEffect3(() => {
    register(id);
    return () => unregister(id);
  }, []);
  const handleOpenChange = (open) => {
    setIsOpen(id, open);
    onOpenChangeCallback?.(open);
  };
  return /* @__PURE__ */ jsx3(FocusModal, { open: getIsOpen(id), onOpenChange: handleOpenChange, children });
};
var Close3 = FocusModal.Close;
Close3.displayName = "StackedFocusModal.Close";
var Header3 = FocusModal.Header;
Header3.displayName = "StackedFocusModal.Header";
var Body3 = FocusModal.Body;
Body3.displayName = "StackedFocusModal.Body";
var Trigger2 = FocusModal.Trigger;
Trigger2.displayName = "StackedFocusModal.Trigger";
var Footer3 = FocusModal.Footer;
Footer3.displayName = "StackedFocusModal.Footer";
var Title3 = FocusModal.Title;
Title3.displayName = "StackedFocusModal.Title";
var Description3 = FocusModal.Description;
Description3.displayName = "StackedFocusModal.Description";
var Content2 = forwardRef2(({ className, ...props }, ref) => {
  return /* @__PURE__ */ jsx3(
    FocusModal.Content,
    {
      ref,
      className: clx3("!top-6", className),
      overlayProps: {
        className: "bg-transparent"
      },
      ...props
    }
  );
});
Content2.displayName = "StackedFocusModal.Content";
var StackedFocusModal = Object.assign(Root3, {
  Close: Close3,
  Header: Header3,
  Body: Body3,
  Content: Content2,
  Trigger: Trigger2,
  Footer: Footer3,
  Description: Description3,
  Title: Title3
});

export {
  RouteDrawer,
  StackedDrawer,
  StackedFocusModal
};
