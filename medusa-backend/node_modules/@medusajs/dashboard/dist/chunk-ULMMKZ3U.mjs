import {
  Form
} from "./chunk-OBQI23QM.mjs";

// src/components/modals/route-modal-provider/use-route-modal.tsx
import { useContext } from "react";

// src/components/modals/route-modal-provider/route-modal-context.tsx
import { createContext } from "react";
var RouteModalProviderContext = createContext(null);

// src/components/modals/route-modal-provider/use-route-modal.tsx
var useRouteModal = () => {
  const context = useContext(RouteModalProviderContext);
  if (!context) {
    throw new Error("useRouteModal must be used within a RouteModalProvider");
  }
  return context;
};

// src/components/modals/route-focus-modal/route-focus-modal.tsx
import { FocusModal, clx } from "@medusajs/ui";
import { useEffect, useState as useState3 } from "react";
import { useNavigate as useNavigate2 } from "react-router-dom";

// src/components/modals/hooks/use-state-aware-to.tsx
import { useMemo } from "react";
import { useLocation } from "react-router-dom";
var useStateAwareTo = (prev) => {
  const location = useLocation();
  const to = useMemo(() => {
    const params = location.state?.restore_params;
    if (params) {
      return `${prev}?${params.toString()}`;
    }
    if (location.search) {
      return `${prev}${location.search}`;
    }
    return prev;
  }, [location.state, location.search, prev]);
  return to;
};

// src/components/modals/route-modal-form/route-modal-form.tsx
import { Prompt } from "@medusajs/ui";
import { useTranslation } from "react-i18next";
import { useBlocker } from "react-router-dom";
import { jsx, jsxs } from "react/jsx-runtime";
var RouteModalForm = ({
  form,
  blockSearchParams: blockSearch = false,
  children,
  onClose
}) => {
  const { t } = useTranslation();
  const {
    formState: { isDirty }
  } = form;
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    const { isSubmitSuccessful: nextIsSuccessful } = nextLocation.state || {};
    const { isSubmitSuccessful: currentIsSuccessful } = currentLocation.state || {};
    const isSubmitSuccessful = nextIsSuccessful || currentIsSuccessful;
    if (isSubmitSuccessful) {
      onClose?.(true);
      return false;
    }
    const isPathChanged = currentLocation.pathname !== nextLocation.pathname;
    const isSearchChanged = currentLocation.search !== nextLocation.search;
    if (blockSearch) {
      const shouldBlock2 = isDirty && (isPathChanged || isSearchChanged);
      if (isPathChanged) {
        onClose?.(isSubmitSuccessful);
      }
      return shouldBlock2;
    }
    const shouldBlock = isDirty && isPathChanged;
    if (isPathChanged) {
      onClose?.(isSubmitSuccessful);
    }
    return shouldBlock;
  });
  const handleCancel = () => {
    blocker?.reset?.();
  };
  const handleContinue = () => {
    blocker?.proceed?.();
    onClose?.(false);
  };
  return /* @__PURE__ */ jsxs(Form, { ...form, children: [
    children,
    /* @__PURE__ */ jsx(Prompt, { open: blocker.state === "blocked", variant: "confirmation", children: /* @__PURE__ */ jsxs(Prompt.Content, { children: [
      /* @__PURE__ */ jsxs(Prompt.Header, { children: [
        /* @__PURE__ */ jsx(Prompt.Title, { children: t("general.unsavedChangesTitle") }),
        /* @__PURE__ */ jsx(Prompt.Description, { children: t("general.unsavedChangesDescription") })
      ] }),
      /* @__PURE__ */ jsxs(Prompt.Footer, { children: [
        /* @__PURE__ */ jsx(Prompt.Cancel, { onClick: handleCancel, type: "button", children: t("actions.cancel") }),
        /* @__PURE__ */ jsx(Prompt.Action, { onClick: handleContinue, type: "button", children: t("actions.continue") })
      ] })
    ] }) })
  ] });
};

// src/components/modals/route-modal-provider/route-provider.tsx
import { useCallback, useMemo as useMemo2, useState } from "react";
import { useLocation as useLocation2, useNavigate } from "react-router-dom";
import { jsx as jsx2 } from "react/jsx-runtime";
var RouteModalProvider = ({
  prev,
  children
}) => {
  const navigate = useNavigate();
  const location = useLocation2();
  const [closeOnEscape, setCloseOnEscape] = useState(true);
  const handleSuccess = useCallback(
    (path) => {
      const to = path || prev;
      if (typeof to === "number") {
        navigate(location.pathname + location.search, {
          replace: true,
          state: { ...location.state, isSubmitSuccessful: true }
        });
        setTimeout(() => {
          navigate(to);
        }, 0);
      } else {
        navigate(to, { replace: true, state: { isSubmitSuccessful: true } });
      }
    },
    [navigate, prev, location]
  );
  const value = useMemo2(
    () => ({
      handleSuccess,
      setCloseOnEscape,
      __internal: { closeOnEscape }
    }),
    [handleSuccess, setCloseOnEscape, closeOnEscape]
  );
  return /* @__PURE__ */ jsx2(RouteModalProviderContext.Provider, { value, children });
};

// src/components/modals/stacked-modal-provider/stacked-modal-provider.tsx
import { useState as useState2 } from "react";

// src/components/modals/stacked-modal-provider/stacked-modal-context.tsx
import { createContext as createContext2 } from "react";
var StackedModalContext = createContext2(null);

// src/components/modals/stacked-modal-provider/stacked-modal-provider.tsx
import { jsx as jsx3 } from "react/jsx-runtime";
var StackedModalProvider = ({
  children,
  onOpenChange
}) => {
  const [state, setState] = useState2({});
  const getIsOpen = (id) => {
    return state[id] || false;
  };
  const setIsOpen = (id, open) => {
    setState((prevState) => ({
      ...prevState,
      [id]: open
    }));
    onOpenChange(open);
  };
  const register = (id) => {
    setState((prevState) => ({
      ...prevState,
      [id]: false
    }));
  };
  const unregister = (id) => {
    setState((prevState) => {
      const newState = { ...prevState };
      delete newState[id];
      return newState;
    });
  };
  return /* @__PURE__ */ jsx3(
    StackedModalContext.Provider,
    {
      value: {
        getIsOpen,
        setIsOpen,
        register,
        unregister
      },
      children
    }
  );
};

// src/components/modals/stacked-modal-provider/use-stacked-modal.ts
import { useContext as useContext2 } from "react";
var useStackedModal = () => {
  const context = useContext2(StackedModalContext);
  if (!context) {
    throw new Error(
      "useStackedModal must be used within a StackedModalProvider"
    );
  }
  return context;
};

// src/components/modals/route-focus-modal/route-focus-modal.tsx
import { jsx as jsx4 } from "react/jsx-runtime";
var Root = ({ prev = "..", children }) => {
  const navigate = useNavigate2();
  const [open, setOpen] = useState3(false);
  const [stackedModalOpen, onStackedModalOpen] = useState3(false);
  const to = (
    // eslint-disable-next-line react-hooks/rules-of-hooks
    typeof prev === "number" ? prev : useStateAwareTo(prev)
  );
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
      if (typeof to === "number") {
        navigate(to);
      } else {
        navigate(to, { replace: true });
      }
      return;
    }
    setOpen(open2);
  };
  return /* @__PURE__ */ jsx4(FocusModal, { open, onOpenChange: handleOpenChange, children: /* @__PURE__ */ jsx4(RouteModalProvider, { prev: to, children: /* @__PURE__ */ jsx4(StackedModalProvider, { onOpenChange: onStackedModalOpen, children: /* @__PURE__ */ jsx4(Content, { stackedModalOpen, children }) }) }) });
};
var Content = ({ stackedModalOpen, children }) => {
  const { __internal } = useRouteModal();
  const shouldPreventClose = !__internal.closeOnEscape;
  return /* @__PURE__ */ jsx4(
    FocusModal.Content,
    {
      onEscapeKeyDown: shouldPreventClose ? (e) => {
        e.preventDefault();
      } : void 0,
      className: clx({
        "!bg-ui-bg-disabled !inset-x-5 !inset-y-3": stackedModalOpen
      }),
      children
    }
  );
};
var Header = FocusModal.Header;
var Title = FocusModal.Title;
var Description = FocusModal.Description;
var Footer = FocusModal.Footer;
var Body = FocusModal.Body;
var Close = FocusModal.Close;
var Form2 = RouteModalForm;
var RouteFocusModal = Object.assign(Root, {
  Header,
  Title,
  Body,
  Description,
  Footer,
  Close,
  Form: Form2
});

export {
  useStateAwareTo,
  RouteModalForm,
  RouteModalProvider,
  StackedModalProvider,
  useStackedModal,
  useRouteModal,
  RouteFocusModal
};
