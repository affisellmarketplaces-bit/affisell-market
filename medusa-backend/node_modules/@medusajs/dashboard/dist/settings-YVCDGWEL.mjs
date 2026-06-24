import "./chunk-IUCDCPJU.mjs";
import {
  KeyboundForm
} from "./chunk-6HTZNHPT.mjs";
import {
  RouteDrawer
} from "./chunk-OV6YUU3D.mjs";
import {
  useRouteModal
} from "./chunk-ULMMKZ3U.mjs";
import "./chunk-OBQI23QM.mjs";
import {
  useBatchTranslationSettings,
  useTranslationSettings
} from "./chunk-FAB3VINY.mjs";
import "./chunk-FXYH54JP.mjs";
import "./chunk-774WSTCC.mjs";
import "./chunk-NFEK63OE.mjs";
import "./chunk-QZ7TP4HQ.mjs";

// src/routes/translations/settings/settings.tsx
import { Heading } from "@medusajs/ui";
import { Spinner } from "@medusajs/icons";

// src/routes/translations/settings/components/batch-translation-settings-form/batch-translation-settings-form.tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { Button as Button3, Divider as Divider2, toast } from "@medusajs/ui";
import { useState as useState3, useRef, useMemo as useMemo2 } from "react";
import { useForm } from "react-hook-form";
import { useTranslation as useTranslation2 } from "react-i18next";
import * as zod from "zod";

// src/routes/translations/settings/components/entity-selector-tree/entity-selector-tree.tsx
import { TriangleRightMini } from "@medusajs/icons";
import { Checkbox, clx, Divider, Text } from "@medusajs/ui";
import React, { useImperativeHandle, useMemo, useState, useEffect } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
var SelectorRow = ({
  leftElement,
  expandButton,
  checked,
  onCheckedChange,
  label,
  className
}) => {
  const isSelected = checked !== false;
  return /* @__PURE__ */ jsxs("div", { className: clx("flex items-center gap-x-2 px-2 py-1.5", className), children: [
    leftElement,
    /* @__PURE__ */ jsx(Checkbox, { checked, onCheckedChange }),
    expandButton,
    /* @__PURE__ */ jsx(
      Text,
      {
        size: "small",
        weight: isSelected ? "plus" : "regular",
        className: "text-ui-fg-base",
        children: label
      }
    )
  ] });
};
var EntitySelectorTree = React.forwardRef(({ entities, onSelectionChange, searchQuery, viewMode, sortOrder }, ref) => {
  const [expandedEntities, setExpandedEntities] = useState(
    /* @__PURE__ */ new Set()
  );
  const [selectedIds, setSelectedIds] = useState(/* @__PURE__ */ new Set());
  useEffect(() => {
    const ids = /* @__PURE__ */ new Set();
    entities.forEach((entity) => {
      entity.fields?.forEach((field) => {
        if (field.selected) {
          ids.add(`${entity.id}.${field.id}`);
        }
      });
    });
    setSelectedIds(ids);
  }, [entities]);
  const toggleExpand = (entityId) => {
    setExpandedEntities((prev) => {
      const next = new Set(prev);
      if (next.has(entityId)) {
        next.delete(entityId);
      } else {
        next.add(entityId);
      }
      return next;
    });
  };
  const getEntitySelectionState = (entity) => {
    if (!entity.fields?.length) {
      return false;
    }
    const selectedFieldsCount = entity.fields.filter(
      (field) => selectedIds.has(`${entity.id}.${field.id}`)
    ).length;
    if (selectedFieldsCount === 0) {
      return false;
    }
    if (selectedFieldsCount === entity.fields.length) {
      return true;
    }
    return "indeterminate";
  };
  const toggleEntitySelection = (entity) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const state = getEntitySelectionState(entity);
      const isSelected = state === true;
      entity.fields?.forEach((field) => {
        const fieldKey = `${entity.id}.${field.id}`;
        if (isSelected) {
          next.delete(fieldKey);
        } else {
          next.add(fieldKey);
        }
      });
      onSelectionChange?.(next);
      return next;
    });
  };
  const toggleFieldSelection = (entityId, fieldId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const fieldKey = `${entityId}.${fieldId}`;
      if (next.has(fieldKey)) {
        next.delete(fieldKey);
      } else {
        next.add(fieldKey);
      }
      onSelectionChange?.(next);
      return next;
    });
  };
  const selectAllToggle = (selected) => {
    if (selected) {
      const allIds = /* @__PURE__ */ new Set();
      entities.forEach((entity) => {
        entity.fields?.forEach((field) => {
          allIds.add(`${entity.id}.${field.id}`);
        });
      });
      setSelectedIds(allIds);
      onSelectionChange?.(allIds);
    } else {
      setSelectedIds(/* @__PURE__ */ new Set());
      onSelectionChange?.(/* @__PURE__ */ new Set());
    }
  };
  const collapseAll = () => setExpandedEntities(/* @__PURE__ */ new Set());
  useImperativeHandle(ref, () => ({
    selectAllToggle,
    collapseAll
  }));
  const filteredAndSortedEntities = useMemo(() => {
    let filtered = entities;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = entities.filter((entity) => {
        const matchesEntity = entity.name.toLowerCase().includes(query);
        const matchesFields = entity.fields?.some(
          (field) => field.name.toLowerCase().includes(query)
        );
        return matchesEntity || matchesFields;
      });
    }
    if (viewMode === "selected") {
      filtered = filtered.filter((entity) => {
        const state = getEntitySelectionState(entity);
        if (state === false) {
          return false;
        }
        return true;
      });
    }
    const sorted = [...filtered].sort((a, b) => {
      const comparison = a.name.localeCompare(b.name);
      return sortOrder === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [entities, searchQuery, viewMode, sortOrder, selectedIds]);
  return /* @__PURE__ */ jsx("div", { className: "flex h-full flex-col", children: /* @__PURE__ */ jsx("div", { className: "flex-1 overflow-y-auto", children: filteredAndSortedEntities.length === 0 ? /* @__PURE__ */ jsx("div", { className: "text-ui-fg-subtle flex items-center justify-center py-12 text-sm", children: "No entities matching filters" }) : /* @__PURE__ */ jsx("div", { children: filteredAndSortedEntities.map((entity) => {
    const isExpanded = expandedEntities.has(entity.id);
    const hasFields = entity.fields && entity.fields.length > 0;
    const selectionState = getEntitySelectionState(entity);
    return /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx(
        SelectorRow,
        {
          checked: selectionState,
          onCheckedChange: () => toggleEntitySelection(entity),
          label: entity.name,
          className: "hover:bg-ui-bg-component-hover",
          expandButton: hasFields ? /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => toggleExpand(entity.id),
              className: "flex h-5 w-5 items-center justify-center",
              children: /* @__PURE__ */ jsx(
                TriangleRightMini,
                {
                  className: clx(
                    "text-ui-fg-muted transition-transform",
                    isExpanded && "rotate-90"
                  )
                }
              )
            }
          ) : null
        }
      ),
      hasFields && isExpanded && /* @__PURE__ */ jsxs("div", { className: "relative", children: [
        /* @__PURE__ */ jsx(
          Divider,
          {
            orientation: "vertical",
            className: "absolute bottom-0 left-[2.87rem] top-0 z-10"
          }
        ),
        entity.fields.map((field) => {
          const fieldKey = `${entity.id}.${field.id}`;
          const isFieldSelected = selectedIds.has(fieldKey);
          return /* @__PURE__ */ jsx(
            SelectorRow,
            {
              className: "pl-3",
              leftElement: /* @__PURE__ */ jsx("div", { className: "w-11" }),
              checked: isFieldSelected,
              onCheckedChange: () => {
                toggleFieldSelection(entity.id, field.id);
              },
              label: field.name
            },
            field.id
          );
        })
      ] })
    ] }, entity.id);
  }) }) }) });
});
EntitySelectorTree.displayName = "EntitySelectorTree";

// src/routes/translations/settings/components/selector-tree-filter/selector-tree-filter.tsx
import { Collapse, DescendingSorting } from "@medusajs/icons";
import { Button as Button2, clx as clx3, IconButton, Input, Tooltip } from "@medusajs/ui";

// src/components/common/segmented-control/segmented-control.tsx
import { Button, clx as clx2 } from "@medusajs/ui";
import { jsx as jsx2 } from "react/jsx-runtime";
var SegmentedControl = ({
  value,
  onValueChange,
  options,
  className
}) => {
  return /* @__PURE__ */ jsx2(
    "div",
    {
      className: clx2(
        "bg-ui-bg-disabled grid items-center gap-x-[1px] rounded-md p-[1px]",
        className
      ),
      style: {
        gridTemplateColumns: `repeat(${options.length}, 1fr)`
      },
      children: options.map((option) => {
        const isSelected = value === option.value;
        return /* @__PURE__ */ jsx2(
          Button,
          {
            size: "small",
            onClick: () => onValueChange(option.value),
            variant: isSelected ? "secondary" : "transparent",
            type: "button",
            className: clx2(
              "w-auto",
              !isSelected && "hover:text-ui-fg-base text-ui-fg-muted"
            ),
            children: option.label
          },
          option.value
        );
      })
    }
  );
};

// src/routes/translations/settings/components/selector-tree-filter/selector-tree-filter.tsx
import { useTranslation } from "react-i18next";
import { useState as useState2 } from "react";
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
var SelectorTreeFilter = ({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onSelectAllToggle,
  initialAllSelected,
  onSortToggle,
  sortOrder,
  onCollapseAll,
  className
}) => {
  const { t } = useTranslation();
  const [allSelected, setAllSelected] = useState2(initialAllSelected);
  const handleSelectAllToggle = () => {
    setAllSelected((prev) => !prev);
    onSelectAllToggle(!allSelected);
  };
  return /* @__PURE__ */ jsxs2("div", { className: clx3("flex items-center gap-x-2", className), children: [
    /* @__PURE__ */ jsx3("div", { className: "flex-1", children: /* @__PURE__ */ jsx3(
      Input,
      {
        size: "small",
        type: "search",
        placeholder: t("general.search"),
        value: searchQuery,
        onChange: (e) => onSearchChange(e.target.value),
        className: "w-full"
      }
    ) }),
    /* @__PURE__ */ jsx3(
      SegmentedControl,
      {
        value: viewMode,
        onValueChange: (value) => onViewModeChange(value),
        options: [
          { value: "full", label: t("general.fullList") },
          { value: "selected", label: t("general.selected") }
        ]
      }
    ),
    /* @__PURE__ */ jsx3(
      Button2,
      {
        onClick: handleSelectAllToggle,
        size: "small",
        variant: "secondary",
        type: "button",
        className: "min-w-[90px] whitespace-nowrap",
        children: allSelected ? t("general.unselectAll") : t("general.selectAll")
      }
    ),
    /* @__PURE__ */ jsx3(
      Tooltip,
      {
        content: sortOrder === "desc" ? t("filters.sorting.alphabeticallyAsc") : t("filters.sorting.alphabeticallyDesc"),
        children: /* @__PURE__ */ jsx3(IconButton, { size: "small", onClick: onSortToggle, type: "button", children: /* @__PURE__ */ jsx3(DescendingSorting, {}) })
      }
    ),
    /* @__PURE__ */ jsx3(Tooltip, { content: t("filters.collapse.all"), children: /* @__PURE__ */ jsx3(IconButton, { size: "small", onClick: onCollapseAll, type: "button", children: /* @__PURE__ */ jsx3(Collapse, {}) }) })
  ] });
};

// src/routes/translations/settings/components/batch-translation-settings-form/batch-translation-settings-form.tsx
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
var BatchTranslationSettingsSchema = zod.object({
  selectedFields: zod.array(zod.string())
});
var format = (value) => {
  return value.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
};
var transformSettingsToEntities = (translationSettings) => {
  return Object.entries(translationSettings).map(([entityType, settings]) => {
    const allFields = [
      .../* @__PURE__ */ new Set([...settings.fields, ...settings.inactive_fields])
    ];
    const fields = allFields.map((fieldName) => ({
      id: fieldName,
      name: format(fieldName),
      selected: settings.fields.includes(fieldName)
    }));
    return {
      id: entityType,
      name: format(entityType),
      fields: fields.length > 0 ? fields : void 0,
      selected: settings.is_active
    };
  });
};
var transformSelectedFieldsToBatchRequest = (selectedFields, translationSettings) => {
  const create = [];
  const update = [];
  const entitySelections = /* @__PURE__ */ new Map();
  selectedFields.forEach((field) => {
    const [entityType, fieldName] = field.split(".", 2);
    if (!entitySelections.has(entityType)) {
      entitySelections.set(entityType, /* @__PURE__ */ new Set());
    }
    entitySelections.get(entityType).add(fieldName);
  });
  Object.entries(translationSettings).forEach(([entityType, settings]) => {
    const selectedFields2 = entitySelections.get(entityType) || /* @__PURE__ */ new Set();
    const selectedFieldsArray = Array.from(selectedFields2);
    const hasSelectedFields = selectedFields2.size > 0;
    const exists = !!settings.id;
    if (exists) {
      update.push({
        id: settings.id,
        fields: selectedFieldsArray,
        is_active: hasSelectedFields ? true : false
      });
    } else {
      if (hasSelectedFields) {
        create.push({
          entity_type: entityType,
          fields: selectedFieldsArray
        });
      }
    }
  });
  return {
    create: create.length > 0 ? create : void 0,
    update: update.length > 0 ? update : void 0
  };
};
var BatchTranslationSettingsForm = ({
  translation_settings
}) => {
  const { t } = useTranslation2();
  const { handleSuccess } = useRouteModal();
  const [searchQuery, setSearchQuery] = useState3("");
  const [viewMode, setViewMode] = useState3("full");
  const [sortOrder, setSortOrder] = useState3("asc");
  const treeRef = useRef(null);
  const { mutateAsync, isPending: isMutating } = useBatchTranslationSettings();
  const entities = useMemo2(() => {
    if (!translation_settings) {
      return [];
    }
    return transformSettingsToEntities(translation_settings);
  }, [translation_settings]);
  const initialSelectedIds = useMemo2(() => {
    if (!translation_settings) {
      return [];
    }
    const selected = [];
    Object.entries(translation_settings).forEach(([entityType, settings]) => {
      settings.fields.forEach((fieldName) => {
        selected.push(`${entityType}.${fieldName}`);
      });
    });
    return selected;
  }, [translation_settings]);
  const inactiveEntities = useMemo2(() => {
    return entities.filter((entity) => !entity.selected);
  }, [entities]);
  const form = useForm({
    defaultValues: {
      selectedFields: initialSelectedIds
    },
    resolver: zodResolver(BatchTranslationSettingsSchema)
  });
  const handleSelectionChange = (newSelectedIds) => {
    form.setValue("selectedFields", Array.from(newSelectedIds), {
      shouldDirty: true
    });
  };
  const handleSelectAllToggle = (selected) => {
    treeRef.current?.selectAllToggle(selected);
  };
  const handleCollapseAll = () => {
    treeRef.current?.collapseAll();
  };
  const handleSortToggle = () => {
    setSortOrder((prev) => {
      return prev === "asc" ? "desc" : "asc";
    });
  };
  const handleSubmit = form.handleSubmit(async (data) => {
    const batchRequest = transformSelectedFieldsToBatchRequest(
      data.selectedFields,
      translation_settings
    );
    if (batchRequest.create || batchRequest.update) {
      await mutateAsync(batchRequest, {
        onSuccess: () => {
          toast.success(t("translations.settings.successToast"));
          handleSuccess();
        },
        onError: (error) => {
          toast.error(error.message);
        }
      });
    } else {
      handleSuccess();
    }
  });
  return /* @__PURE__ */ jsx4(RouteDrawer.Form, { form, children: /* @__PURE__ */ jsxs3(
    KeyboundForm,
    {
      onSubmit: handleSubmit,
      className: "flex flex-1 flex-col overflow-hidden",
      children: [
        /* @__PURE__ */ jsxs3(RouteDrawer.Body, { className: "p-0", children: [
          /* @__PURE__ */ jsx4("div", { className: "px-6 py-4", children: /* @__PURE__ */ jsx4(
            SelectorTreeFilter,
            {
              sortOrder,
              searchQuery,
              onSearchChange: setSearchQuery,
              viewMode,
              onViewModeChange: setViewMode,
              onSelectAllToggle: handleSelectAllToggle,
              initialAllSelected: inactiveEntities.length === 0,
              onSortToggle: handleSortToggle,
              onCollapseAll: handleCollapseAll
            }
          ) }),
          /* @__PURE__ */ jsx4(Divider2, {}),
          /* @__PURE__ */ jsx4("div", { className: "bg-ui-bg-component h-full px-6 pb-6 pt-4", children: /* @__PURE__ */ jsx4(
            EntitySelectorTree,
            {
              ref: treeRef,
              entities,
              onSelectionChange: handleSelectionChange,
              searchQuery,
              viewMode,
              sortOrder
            }
          ) })
        ] }),
        /* @__PURE__ */ jsx4(RouteDrawer.Footer, { children: /* @__PURE__ */ jsxs3("div", { className: "flex items-center gap-x-2", children: [
          /* @__PURE__ */ jsx4(RouteDrawer.Close, { asChild: true, children: /* @__PURE__ */ jsx4(Button3, { variant: "secondary", size: "small", children: t("actions.cancel") }) }),
          /* @__PURE__ */ jsx4(Button3, { size: "small", type: "submit", isLoading: isMutating, children: t("actions.save") })
        ] }) })
      ]
    }
  ) });
};

// src/routes/translations/settings/settings.tsx
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
var Settings = () => {
  const { translation_settings, isPending, isError, error } = useTranslationSettings();
  if (isError) {
    throw error;
  }
  return /* @__PURE__ */ jsxs4(RouteDrawer, { children: [
    /* @__PURE__ */ jsx5(RouteDrawer.Header, { children: /* @__PURE__ */ jsx5(RouteDrawer.Title, { asChild: true, children: /* @__PURE__ */ jsx5(Heading, { children: "Manage translatable entities" }) }) }),
    isPending ? /* @__PURE__ */ jsx5(RouteDrawer.Body, { className: "flex h-full items-center justify-center", children: /* @__PURE__ */ jsx5(Spinner, { className: "animate-spin" }) }) : translation_settings && /* @__PURE__ */ jsx5(
      BatchTranslationSettingsForm,
      {
        translation_settings
      }
    )
  ] });
};
export {
  Settings as Component
};
